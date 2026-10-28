import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyConversation,
  normalizeConversation,
  conversationText,
  conversationLabel,
} from "../src/lib/conversation";
import {
  emptyTimeline,
  normalizeEvent,
  shouldFollow,
} from "../src/lib/timeline";
const run = (...payloads: unknown[]) =>
  payloads.reduce<ReturnType<typeof emptyConversation>>(
    (s, payload) =>
      normalizeConversation(s, { event: "message", payload, receivedAt: 1000 }),
    emptyConversation(),
  );
const transcript = (role: string, text: string, final = false) => ({
  type: "transcript",
  role,
  transcript: text,
  transcriptType: final ? "final" : "partial",
});
const speech = (role: string, status: string, turn?: number) => ({
  type: "speech-update",
  role,
  status,
  turn,
});
test("user and assistant partials replace in one stable bubble, final sentences reconcile without repeats", () => {
  const s = run(
    speech("user", "started", 0),
    transcript("user", "Check"),
    transcript("user", "Check order 123"),
    transcript("user", "Check order 123", true),
    speech("assistant", "started", 1),
    transcript("assistant", "Your boots"),
    transcript("assistant", "Your boots were delivered.", true),
    transcript("assistant", "Your boots were delivered.", true),
    transcript("assistant", "Anything else?", true),
    speech("assistant", "stopped", 1),
  );
  assert.equal(s.messages.length, 2);
  assert.equal(conversationText(s.messages[0]), "Check order 123");
  assert.equal(
    conversationText(s.messages[1]),
    "Your boots were delivered. Anything else?",
  );
  assert.equal(s.messages[1].status, "complete");
  assert.equal(s.messages[1].id, 1);
});
test("model tokens are provisional, tool-call objects are ignored, playback captions are cumulative", () => {
  const s = run(
    { type: "model-output", turnId: "a", output: "Your " },
    {
      type: "model-output",
      turnId: "a",
      output: { content: "boots arrived." },
    },
    {
      type: "model-output",
      output: { tool_calls: [{ function: { name: "lookup_order" } }] },
    },
    { type: "assistant.speechStarted", turn: 1, text: "Your boots" },
    { type: "assistant.speechStarted", turn: 1, text: "Your boots arrived." },
  );
  assert.equal(s.messages.length, 1);
  assert.equal(conversationText(s.messages[0]), "Your boots arrived.");
  assert.match(conversationLabel(s.messages[0]), /Playback text/);
  const generated = run({ type: "model-output", output: "Hello" });
  assert.match(
    conversationLabel(generated.messages[0]),
    /not confirmed spoken/,
  );
});
test("interruption retains speech evidence and rejects late generated tokens for the interrupted turn", () => {
  const s = run(
    {
      type: "model-output",
      turnId: "a",
      output: "Your boots arrived yesterday. Can I help?",
    },
    transcript("assistant", "Your boots arrived"),
    { type: "user-interrupted", turnId: "a" },
    { type: "model-output", turnId: "a", output: " More." },
    transcript("user", "Wait", true),
    transcript("assistant", "Your boots arrived.", true),
  );
  assert.equal(s.messages.length, 2);
  assert.equal(s.messages[0].status, "interrupted");
  assert.equal(conversationText(s.messages[0]), "Your boots arrived.");
  assert.equal(s.messages[0].generated, "");
});
test("multiple turns, repeated phrases and identical duplicate finals keep order and stable IDs", () => {
  const s = run(
    transcript("user", "Thanks", true),
    speech("assistant", "started", 1),
    transcript("assistant", "You are welcome.", true),
    speech("assistant", "stopped", 1),
    transcript("user", "Thanks", true),
    speech("assistant", "started", 2),
    transcript("assistant", "You are welcome.", true),
    speech("assistant", "stopped", 2),
  );
  assert.deepEqual(
    s.messages.map((m) => m.role),
    ["user", "assistant", "user", "assistant"],
  );
  assert.deepEqual(
    s.messages.map((m) => m.id),
    [0, 1, 2, 3],
  );
  assert.equal(s.messages[3].confirmed, "You are welcome.");
});
test("tool success and failure events do not become dialogue or disrupt assistant progress", () => {
  for (const name of ["lookup_order", "check_inventory"])
    for (const failed of [false, true]) {
      const events = [
        transcript("user", "Check please", true),
        {
          type: "tool-calls",
          toolCallList: [{ id: "a", function: { name, arguments: "{}" } }],
        },
        {
          type: "tool-calls-result",
          toolCallResult: {
            toolCallId: "a",
            result: failed
              ? '{"error":"Unavailable"}'
              : '{"status":"available"}',
          },
        },
        speech("assistant", "started", 1),
        transcript(
          "assistant",
          failed ? "I couldn't check that." : "Here is the result.",
          true,
        ),
        speech("assistant", "stopped", 1),
      ];
      const s = run(...events);
      assert.equal(s.messages.length, 2);
      const timeline = events.reduce(
        (s, payload) =>
          normalizeEvent(s, { event: "message", payload, receivedAt: 1000 }),
        emptyTimeline(),
      );
      assert.equal(
        timeline.entries.find((e) => e.kind === "tool")?.status,
        failed ? "error" : "success",
      );
    }
});
test("disconnect closes pending text and manual scroll remains respected", () => {
  const s = normalizeConversation(run(transcript("assistant", "Hello")), {
    event: "call-end",
    payload: {},
    receivedAt: 1000,
  });
  assert.equal(s.messages[0].status, "complete");
  assert.equal(shouldFollow(0, 300, 1200), false);
  assert.equal(shouldFollow(900, 300, 1200), true);
});
test("conversation renders provisional provenance; timeline keeps dialogue only in collapsed details", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Conversation } = await import("../src/components/conversation");
  const { ExecutionTimeline } =
    await import("../src/components/execution-timeline");
  const state = run({ type: "model-output", output: "Hello from SEI." });
  assert.match(
    renderToStaticMarkup(
      createElement(Conversation, { messages: state.messages }),
    ),
    /Generated · not confirmed spoken/,
  );
  const timeline = normalizeEvent(emptyTimeline(), {
    event: "message",
    payload: transcript("assistant", "Hello from SEI.", true),
    receivedAt: 1000,
  });
  const html = renderToStaticMarkup(
    createElement(ExecutionTimeline, { timeline, callId: "" }),
  );
  assert.doesNotMatch(html, /<p class="execution-speech">/);
  assert.match(html, /Hello from SEI/);
  assert.doesNotMatch(html, /<details[^>]*open/);
});

test("late partial snapshots do not repeat a finalized sentence; new sentence partials still stream", () => {
  const s = run(
    transcript("assistant", "Your boots arrived.", true),
    transcript("assistant", "Your boots"),
    transcript("assistant", "Can I help"),
  );
  assert.equal(
    conversationText(s.messages[0]),
    "Your boots arrived. Can I help",
  );
});
