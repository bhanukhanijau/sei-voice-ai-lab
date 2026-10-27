// Only observed SDK evidence enters this model. Unknown messages remain in raw.
export type RawEvent = { event: string; receivedAt: number; payload: unknown };
export type Entry = {
  id: string;
  at: number;
  kind: "user" | "assistant" | "tool" | "connection" | "error" | "interruption";
  title: string;
  text?: string;
  status?: "pending" | "success" | "error" | "unknown";
  args?: unknown;
  result?: unknown;
  error?: string;
  category?: string;
  httpStatus?: number;
  durationMs?: number;
  raw: number[];
  final?: boolean;
  turn?: number;
};
export type TimelineState = {
  raw: RawEvent[];
  entries: Entry[];
  live: string;
  startedAt: number | null;
};
export const emptyTimeline = (): TimelineState => ({
  raw: [],
  entries: [],
  live: "",
  startedAt: null,
});
const obj = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const str = (x: unknown) => (typeof x === "string" ? x : "");
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
export function parseData(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
export function errorText(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  const e = obj(value);
  return (
    str(e.message) ||
    str(e.errorMsg) ||
    (e.error ? errorText(e.error) : "") ||
    JSON.stringify(value) ||
    "No error details supplied"
  );
}
export function normalizeEvent(
  previous: TimelineState,
  input: RawEvent,
): TimelineState {
  const index = previous.raw.length;
  const state: TimelineState = {
    ...previous,
    raw: [...previous.raw, input],
    entries: previous.entries.map((e) => ({ ...e, raw: [...e.raw] })),
  };
  const m = obj(input.payload),
    at = input.receivedAt;
  const add = (entry: Omit<Entry, "raw" | "at" | "id"> & { id?: string }) => {
    const e: Entry = {
      ...entry,
      id: entry.id || `event-${index}`,
      at,
      raw: [index],
    };
    state.entries.push(e);
    return e;
  };
  const type = input.event === "message" ? str(m.type) : input.event;
  if (type === "call-start") {
    if (state.startedAt === null) {
      state.startedAt = at;
      add({ kind: "connection", title: "Call connected", status: "success" });
    }
  } else if (type === "call-end") {
    add({ kind: "connection", title: "Call disconnected" });
    state.live = "";
    for (const e of state.entries)
      if (e.kind === "tool" && e.status === "pending") e.status = "unknown";
  } else if (type === "error") {
    const status = obj(m.response).status ?? m.statusCode ?? m.status;
    add({
      kind: "error",
      title: "Call error",
      error: errorText(input.payload),
      status: "error",
      httpStatus: typeof status === "number" ? status : undefined,
      category:
        m.type === "network-error"
          ? "Network error"
          : "Call error · cause not identified",
    });
    state.live = "";
  } else if (type === "user-interrupted") {
    add({
      kind: "interruption",
      title: "Assistant interrupted",
      text: "Vapi reported an interruption.",
    });
    state.live = "";
  } else if (
    type === "speech-update" ||
    type === "transcript" ||
    type === "transcript[transcriptType='final']"
  ) {
    const role = m.role;
    if (role !== "user" && role !== "assistant") return state;
    const final = type !== "speech-update" && m.transcriptType === "final";
    const text = str(m.transcript);
    if (type !== "speech-update" && !final) {
      state.live = `${role === "user" ? "User" : "Assistant"}: ${text}`;
      return state;
    }
    if (type === "speech-update" && m.status !== "started") {
      state.live = "";
      return state;
    }
    let entry = state.entries.findLast(
      (e) =>
        e.kind === role &&
        !e.final &&
        (m.turn === undefined || e.turn === undefined || e.turn === m.turn),
    );
    // Repeat delivery of the same final payload is not a new utterance. A later turn may repeat words.
    const last = state.entries.at(-1);
    if (
      final &&
      !entry &&
      last?.kind === role &&
      last.text === text &&
      at - last.at < 1500
    ) {
      last.raw.push(index);
      return state;
    }
    if (!entry)
      entry = add({
        kind: role,
        title:
          role === "user"
            ? "User started speaking"
            : "Assistant started responding",
        turn: typeof m.turn === "number" ? m.turn : undefined,
      });
    else entry.raw.push(index);
    if (final) {
      entry.title = role === "user" ? "User spoke" : "Assistant responded";
      entry.text = text;
      entry.final = true;
      state.live = "";
    } else
      state.live = role === "user" ? "User speaking…" : "Assistant responding…";
  }
  function invocation(value: unknown) {
    const c = obj(value),
      f = obj(c.function),
      id = str(c.id);
    if (!id || !str(f.name)) return;
    const existing = state.entries.find((e) => e.id === `tool-${id}`);
    if (existing) {
      if (existing.args === undefined) existing.args = parseData(f.arguments);
      if (existing.title === "Tool result") existing.title = str(f.name);
      return;
    }
    add({
      id: `tool-${id}`,
      kind: "tool",
      title: str(f.name),
      args: parseData(f.arguments),
      status: "pending",
    });
  }
  function result(value: unknown) {
    const r = obj(value),
      id = str(r.toolCallId) || str(r.tool_call_id);
    if (!id) return; // Never attach an uncorrelated result to the most recent tool.
    let e = state.entries.find((e) => e.id === `tool-${id}`);
    const output = parseData(r.result ?? r.content),
      data = obj(output);
    if (!e)
      e = add({
        id: `tool-${id}`,
        kind: "tool",
        title: str(r.name) || "Tool result",
        status: "unknown",
      });
    else if (e.raw.at(-1) !== index) e.raw.push(index);
    const err = r.error ?? data.error;
    const meta = obj(r.metadata),
      http = r.httpStatus ?? meta.httpStatus ?? meta.statusCode;
    e.httpStatus = typeof http === "number" ? http : e.httpStatus;
    const failed =
      err !== undefined || (e.httpStatus !== undefined && e.httpStatus >= 400);
    e.status = failed ? "error" : output !== undefined ? "success" : "unknown";
    e.result = output;
    e.error = undefined;
    e.category = undefined;
    if (failed) {
      e.error = err !== undefined ? errorText(err) : `HTTP ${e.httpStatus}`;
      e.category =
        e.httpStatus && e.httpStatus >= 400
          ? "HTTP error"
          : /^(Order \d+ was not found|Product not found|Customer not found)/.test(
                e.error,
              )
            ? "Business error"
            : str(meta.errorType) === "protocol"
              ? "Tool protocol error"
              : str(meta.errorType) === "network"
                ? "Network error"
                : "Tool error · cause not identified";
    }
    // Only server-supplied timing is labeled execution duration. Receipt deltas include transport.
    const duration = r.durationMs ?? meta.durationMs;
    e.durationMs =
      typeof duration === "number" && duration >= 0 ? duration : e.durationMs;
  }
  if (type === "tool-calls") {
    for (const c of list(m.toolCallList)) invocation(c);
    for (const t of list(m.toolWithToolCallList)) invocation(obj(t).toolCall);
  }
  if (type === "tool-calls-result") {
    if (m.toolCallResult) result(m.toolCallResult);
    for (const r of list(m.results)) result(r);
  }
  if (type === "conversation-update") {
    // History can recover server tool results absent from the direct event stream.
    // Do not replay conversation text: finalized transcript events own speech entries.
    for (const value of [
      ...list(m.messages),
      ...list(m.messagesOpenAIFormatted),
    ]) {
      const h = obj(value);
      for (const c of [...list(h.toolCalls), ...list(h.tool_calls)])
        invocation(c);
      if (
        h.role === "tool" ||
        h.role === "tool_call_result" ||
        h.role === "function"
      )
        result(h);
    }
  }
  return state;
}
export function businessFields(value: unknown): [string, string][] {
  return Object.entries(obj(value))
    .filter(
      ([, v]) =>
        v !== null && ["string", "number", "boolean"].includes(typeof v),
    )
    .map(([k, v]) => [
      k.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
      String(v),
    ]);
}
export function relativeTime(at: number, start: number | null) {
  if (start === null || at < start) return "Before connection";
  const seconds = (at - start) / 1000;
  return `+${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}
export function shouldFollow(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
) {
  return scrollHeight - scrollTop - clientHeight < 70;
}
