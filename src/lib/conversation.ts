import type { RawEvent } from "./timeline";

export type ConversationMessage = {
  id: number;
  role: "user" | "assistant";
  turn?: number;
  turnId?: string;
  confirmed: string;
  partial: string;
  caption: string;
  text: string;
  source?: "transcript" | "playback";
  phase: "preparing" | "speaking";
  status: "live" | "complete" | "interrupted";
  lastFinal?: string;
};
export type ConversationState = {
  messages: ConversationMessage[];
  nextId: number;
};
export const emptyConversation = (): ConversationState => ({
  messages: [],
  nextId: 0,
});
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const string = (v: unknown) => (typeof v === "string" ? v : "");

// Partial transcripts are snapshots, not deltas. Final fragments may overlap at word boundaries.
function join(a: string, b: string) {
  if (!a || b.startsWith(a)) return b;
  if (!b || a === b || a.endsWith(b)) return a;
  const left = a.split(/\s+/),
    right = b.split(/\s+/);
  for (let n = Math.min(left.length, right.length); n > 0; n--)
    if (left.slice(-n).join(" ") === right.slice(0, n).join(" "))
      return [...left, ...right.slice(n)].join(" ");
  return `${a} ${b}`;
}
export const conversationText = (m: ConversationMessage) => m.text;
export function conversationLabel(m: ConversationMessage) {
  return `${m.status === "interrupted" ? "Interrupted · " : m.status === "live" ? "Live · " : ""}${m.source === "playback" ? "Playback progress · provider-reported" : "Transcript"}`;
}
export function conversationActivity(messages: ConversationMessage[]) {
  const active = messages.findLast((m) => m.status === "live");
  if (!active) return "";
  return active.role === "user"
    ? "Listening…"
    : active.phase === "preparing"
      ? "Preparing response…"
      : "Speaking…";
}
export function normalizeConversation(
  previous: ConversationState,
  input: RawEvent,
): ConversationState {
  const m = object(input.payload),
    type = input.event === "message" ? m.type : input.event;
  const transcript =
    type === "transcript" || type === "transcript[transcriptType='final']";
  const speech = type === "speech-update",
    caption = type === "assistant.speechStarted",
    model = type === "model-output";
  if (type === "call-end" || type === "error")
    return {
      ...previous,
      messages: previous.messages.map((m) => ({
        ...m,
        status: m.status === "live" ? "complete" : m.status,
      })),
    };
  if (type === "user-interrupted") {
    const messages = previous.messages.map((m) => ({ ...m }));
    // Match a supplied LLM ID exactly before considering an unbound active turn.
    const turnId = string(m.turnId);
    const target =
      (turnId &&
        messages.findLast(
          (e) => e.role === "assistant" && e.turnId === turnId,
        )) ||
      messages.findLast(
        (e) =>
          e.role === "assistant" &&
          (!turnId || (!e.turnId && e.status === "live")),
      );
    if (target) {
      target.status = "interrupted";
      target.turnId ??= turnId || undefined;
      // Only speech evidence survives interruption. Full model output never enters dialogue.
      // text already contains only transcript/provider-progress evidence; keep its longest observed prefix.
    }
    return { ...previous, messages };
  }
  if (!transcript && !speech && !caption && !model) return previous;
  const role = caption || model ? "assistant" : m.role;
  if (role !== "user" && role !== "assistant") return previous;
  if (
    model &&
    !(typeof m.output === "string"
      ? m.output
      : string(object(m.output).content))
  )
    return previous;
  const final =
    transcript && (m.transcriptType === "final" || type !== "transcript");
  const text = string(m.transcript);
  if (transcript && !text.trim()) return previous;
  const messages = previous.messages.map((m) => ({ ...m }));
  const turn = typeof m.turn === "number" ? m.turn : undefined,
    turnId = string(m.turnId) || undefined;
  let current = messages.findLast(
    (e) =>
      e.role === role &&
      ((turn !== undefined && e.turn === turn) ||
        (turnId && e.turnId === turnId)),
  );
  if (!current) {
    const last = messages.at(-1);
    const compatible =
      last?.role === role &&
      (turn === undefined || last.turn === undefined) &&
      (!turnId || !last.turnId || last.turnId === turnId);
    if (
      compatible &&
      last.status !== "interrupted" &&
      !(
        last.status === "complete" &&
        (model || (speech && m.status === "started"))
      )
    )
      current = last;
    // Late final speech after barge-in belongs to the interrupted assistant, not a new bubble.
    // Never reach back across a newer assistant turn or override an explicit different identity.
    if (
      !current &&
      transcript &&
      role === "assistant" &&
      turn === undefined &&
      !turnId
    ) {
      const interrupted = messages.findLast((e) => e.role === "assistant");
      if (interrupted?.status === "interrupted") current = interrupted;
    }
    if (!current && caption) {
      const interrupted = messages.findLast((e) => e.role === "assistant");
      if (
        interrupted?.status === "interrupted" &&
        interrupted.turn === undefined
      )
        return previous;
    }
    if (
      !current &&
      final &&
      last?.role === role &&
      last.lastFinal === text &&
      turn === undefined &&
      !turnId
    )
      return previous;
  }
  if (current?.status === "interrupted" && !final) return previous;
  if (!current) {
    if (speech && m.status !== "started") return previous;
    for (const entry of messages)
      if (entry.status === "live") entry.status = "complete";
    current = {
      id: previous.nextId,
      role,
      turn,
      turnId,
      confirmed: "",
      partial: "",
      caption: "",
      text: "",
      phase: model ? "preparing" : "speaking",
      status: "live",
    };
    messages.push(current);
  }
  current.turn ??= turn;
  current.turnId ??= turnId;
  if (speech) {
    if (current.status !== "interrupted") {
      current.status = m.status === "stopped" ? "complete" : "live";
      current.phase = "speaking";
    }
  } else if (model) {
    // Model output can include the entire unspoken response. It only drives a separate status.
    if (!current.text) current.phase = "preparing";
  } else if (caption) {
    current.phase = "speaking";
    const timing = object(m.timing),
      words = string(m.text).match(/\S+\s*/g) || [];
    // A text-only caption may contain the full turn before all its words have played.
    // Use only an explicit provider word-progress cursor; no guessed animation or clock.
    if (
      timing.type === "word-progress" &&
      Number.isInteger(timing.wordsSpoken) &&
      Number(timing.wordsSpoken) > 0 &&
      Number(timing.wordsSpoken) <= words.length
    ) {
      const spoken = words
        .slice(0, Number(timing.wordsSpoken))
        .join("")
        .trimEnd();
      if (spoken.length > current.caption.length) current.caption = spoken;
      if (!current.source || current.source === "playback") {
        current.text = current.caption;
        current.source = "playback";
      }
    }
  } else if (final) {
    if (text !== current.lastFinal)
      current.confirmed = join(current.confirmed, text);
    current.lastFinal = text;
    current.partial = "";
    // Keep a longer provider-confirmed prefix while sentence finals catch up.
    if (!(
      current.source === "playback" &&
      current.text.startsWith(current.confirmed) &&
      current.text.length > current.confirmed.length
    )) {
      current.text = current.confirmed;
      current.source = "transcript";
    }
    if (role === "user" && current.status !== "interrupted")
      current.status = "complete";
  } else if (current.status !== "interrupted") {
    if (
      current.lastFinal?.startsWith(text) ||
      (current.partial.startsWith(text) && current.partial.length > text.length)
    )
      return previous;
    current.partial = text;
    const observed = join(current.confirmed, text);
    if (!(
      current.text.startsWith(observed) && current.text.length > observed.length
    )) {
      current.text = observed;
      current.source = "transcript";
    }
  }
  return { messages, nextId: Math.max(previous.nextId, current.id + 1) };
}
