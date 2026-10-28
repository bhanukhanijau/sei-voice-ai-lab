import type { RawEvent } from "./timeline";

export type ConversationMessage = {
  id: number;
  role: "user" | "assistant";
  turn?: number;
  turnId?: string;
  confirmed: string;
  partial: string;
  generated: string;
  caption: string;
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
// Transcripts are snapshots of an utterance, while final utterances may be separate sentences.
function join(a: string, b: string) {
  if (!a || b.startsWith(a)) return b;
  if (!b || a === b || a.endsWith(b)) return a;
  return `${a} ${b}`;
}
export function conversationText(m: ConversationMessage) {
  return join(m.confirmed, m.partial) || m.caption || m.generated;
}
export function conversationLabel(m: ConversationMessage) {
  const source =
    m.confirmed || m.partial
      ? "Transcript"
      : m.caption
        ? "Playback text · not word-aligned"
        : m.generated
          ? "Generated · not confirmed spoken"
          : "Waiting for speech text";
  return `${m.status === "interrupted" ? "Interrupted · " : m.status === "live" ? "Live · " : ""}${source}`;
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
    const target = messages.findLast(
      (e) =>
        e.role === "assistant" &&
        (!m.turnId || e.turnId === m.turnId || !e.turnId),
    );
    if (target) {
      target.status = "interrupted";
      // Drop generated-ahead text if any stronger speech evidence exists.
      if (target.confirmed || target.partial || target.caption)
        target.generated = "";
    }
    return { ...previous, messages };
  }
  if (!transcript && !speech && !caption && !model) return previous;
  const role = caption || model ? "assistant" : m.role;
  if (role !== "user" && role !== "assistant") return previous;
  let token = "";
  if (model) {
    const output = object(m.output);
    // Never stringify tool calls or arbitrary model objects as dialogue.
    token = typeof m.output === "string" ? m.output : string(output.content);
    if (!token) return previous;
  }
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
    if (
      last?.role === role &&
      (turn === undefined || last.turn === undefined) &&
      (!turnId || !last.turnId || last.turnId === turnId) &&
      !(
        last.status === "interrupted" &&
        (model || caption || (speech && m.status === "started"))
      )
    )
      current = last;
    // Final transcripts may arrive just after barge-in; update the existing assistant bubble.
    if (
      !current &&
      transcript &&
      m.transcriptType === "final" &&
      role === "assistant"
    ) {
      const interrupted = messages.findLast((e) => e.role === "assistant");
      if (interrupted?.status === "interrupted") current = interrupted;
    }
  }
  if (current?.status === "interrupted" && (model || caption)) return previous;
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
      generated: "",
      caption: "",
      status: "live",
    };
    messages.push(current);
  }
  current.turn ??= turn;
  current.turnId ??= turnId;
  if (speech) {
    if (current.status !== "interrupted")
      current.status = m.status === "stopped" ? "complete" : "live";
  } else if (model) {
    current.generated += token;
    current.status = "live";
  } else if (caption) {
    // This field is cumulative, not a token delta. Timing is optional; do not invent a word cursor.
    current.caption = string(m.text);
    current.status = "live";
  } else {
    const text = string(m.transcript);
    if (m.transcriptType === "final" || type !== "transcript") {
      if (text !== current.lastFinal)
        current.confirmed = join(current.confirmed, text);
      current.lastFinal = text;
      current.partial = "";
      if (role === "user" && current.status !== "interrupted")
        current.status = "complete";
    } else if (current.status !== "interrupted") {
      // A delayed partial snapshot must not append the beginning of an already-final sentence.
      if (text && current.lastFinal?.startsWith(text)) return previous;
      current.partial = text;
      current.status = "live";
    }
  }
  return { messages, nextId: Math.max(previous.nextId, current.id + 1) };
}
