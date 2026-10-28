import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyConversation,
  normalizeConversation,
  conversationText,
  conversationLabel,
  conversationActivity,
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
test("generated output and unaligned full-turn captions never enter dialogue", () => {
  const s = run(
    {
      type: "model-output",
      turnId: "a",
      output: "Your boots arrived. Is there anything else?",
    },
    {
      type: "assistant.speechStarted",
      turn: 1,
      text: "Your boots arrived. Is there anything else?",
    },
  );
  assert.equal(s.messages.length, 1);
  assert.equal(conversationText(s.messages[0]), "");
  assert.equal(conversationActivity(s.messages), "Speaking…");
  const prepared = run({ type: "model-output", output: "Hello" });
  assert.equal(conversationActivity(prepared.messages), "Preparing response…");
  assert.equal(conversationText(prepared.messages[0]), "");
  assert.equal(
    run({ type: "model-output", output: { tool_calls: [{}] } }).messages.length,
    0,
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
  assert.doesNotMatch(conversationText(s.messages[0]), /Can I help/);
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
test("preparation stays outside empty dialogue; timeline keeps dialogue only in collapsed details", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Conversation } = await import("../src/components/conversation");
  const { ExecutionTimeline } =
    await import("../src/components/execution-timeline");
  const state = run({ type: "model-output", output: "Hello from SEI." });
  const preparedHtml = renderToStaticMarkup(
    createElement(Conversation, { messages: state.messages }),
  );
  assert.match(preparedHtml, /Preparing response/);
  assert.doesNotMatch(
    preparedHtml,
    /conversation-message assistant|Hello from SEI|Listening for speech text/,
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

test("generated-then-partial sequence reveals only speech, in one stable message without rebuilding", () => {
  let s = run({
    type: "model-output",
    turnId: "a",
    output: "Your boots arrived. Anything else?",
  });
  const id = s.messages[0].id;
  for (const text of ["Your", "Your boots", "Your boots arrived."]) {
    s = normalizeConversation(s, {
      event: "message",
      receivedAt: 1000,
      payload: transcript("assistant", text),
    });
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].id, id);
    assert.equal(conversationText(s.messages[0]), text);
  }
  s = normalizeConversation(s, {
    event: "message",
    receivedAt: 1000,
    payload: transcript("assistant", "Your boots arrived.", true),
  });
  assert.equal(s.messages[0].id, id);
  assert.equal(s.messages[0].text, "Your boots arrived.");
});
test("shorter duplicate partials and full-turn captions cannot erase observed text", () => {
  const s = run(
    transcript("assistant", "Your boots arrived"),
    transcript("assistant", "Your boots"),
    {
      type: "assistant.speechStarted",
      turn: 1,
      text: "Your boots arrived. A much longer response ahead.",
    },
  );
  assert.equal(s.messages.length, 1);
  assert.equal(conversationText(s.messages[0]), "Your boots arrived");
});
test("only an explicit provider word-progress cursor reveals caption text", () => {
  const text = "Your boots arrived. Anything else?";
  const s = run(
    {
      type: "assistant.speechStarted",
      turn: 1,
      text,
      timing: { type: "word-progress", wordsSpoken: 2, totalWords: 5 },
    },
    transcript("assistant", "Your"),
    {
      type: "assistant.speechStarted",
      turn: 1,
      text,
      timing: { type: "word-progress", wordsSpoken: 3, totalWords: 5 },
    },
    { type: "user-interrupted" },
  );
  assert.equal(s.messages.length, 1);
  assert.equal(conversationText(s.messages[0]), "Your boots arrived.");
  assert.match(conversationLabel(s.messages[0]), /Interrupted/);
  assert.doesNotMatch(conversationText(s.messages[0]), /Anything else/);
});
test("interruption without speech leaves no generated bubble or permanent placeholder", () => {
  const s = run(
    {
      type: "model-output",
      turnId: "a",
      output: "An entire unspoken paragraph.",
    },
    { type: "user-interrupted", turnId: "a" },
    { type: "model-output", turnId: "a", output: "More unspoken text" },
  );
  assert.equal(s.messages.filter((m) => conversationText(m)).length, 0);
  assert.equal(conversationActivity(s.messages), "");
});
test("interrupt IDs bind unbound turns and never interrupt a different known turn", () => {
  const s = run(
    speech("assistant", "started", 1),
    transcript("assistant", "One moment"),
    { type: "user-interrupted", turnId: "a" },
    { type: "model-output", turnId: "a", output: "Late output" },
    transcript("user", "Actually check 567", true),
    { type: "model-output", turnId: "b", output: "Checking" },
    speech("assistant", "started", 2),
    transcript("assistant", "Order 567 was cancelled.", true),
    { type: "user-interrupted", turnId: "a" },
  );
  assert.equal(s.messages.length, 3);
  assert.equal(s.messages[0].status, "interrupted");
  assert.equal(s.messages[2].status, "live");
  assert.equal(s.messages[2].text, "Order 567 was cancelled.");
});
test("distinct consecutive assistant turns preserve equal text; duplicate events within a turn collapse", () => {
  const s = run(
    speech("assistant", "started", 1),
    transcript("assistant", "Hello.", true),
    speech("assistant", "stopped", 1),
    speech("assistant", "started", 2),
    transcript("assistant", "Hello.", true),
    transcript("assistant", "Hello.", true),
    speech("assistant", "stopped", 2),
  );
  assert.equal(s.messages.length, 2);
  assert.deepEqual(
    s.messages.map((m) => m.text),
    ["Hello.", "Hello."],
  );
  assert.notEqual(s.messages[0].id, s.messages[1].id);
});
test("overlapping final fragments reconcile without repeating words", () => {
  const s = run(
    transcript("assistant", "Your boots", true),
    transcript("assistant", "boots arrived.", true),
  );
  assert.equal(s.messages[0].text, "Your boots arrived.");
});
test("valid order 567 stays intact and the manual prompt asks only for missing or unclear input", async () => {
  const { orderAssistantPrompt } = await import("../src/lib/assistant-prompt");
  const { normalizeOrderNumber } = await import("../src/lib/order-number");
  const s = run(transcript("user", "Can you tell me about order 567?", true));
  assert.equal(s.messages[0].text, "Can you tell me about order 567?");
  assert.equal(normalizeOrderNumber("567"), "567");
  assert.match(
    orderAssistantPrompt,
    /Use a clearly provided three-digit order number immediately/,
  );
  assert.doesNotMatch(orderAssistantPrompt, /prefer separate digits/);
});

test("late untagged partials/captions cannot resurrect the interrupted bubble as a new response", () => {
  const s = run(
    transcript("assistant", "Your order was cancelled"),
    { type: "user-interrupted", turnId: "a" },
    {
      type: "assistant.speechStarted",
      turn: 1,
      text: "Your order was cancelled. More text.",
    },
    transcript("assistant", "Your order was cancelled. More"),
    transcript("user", "Wait", true),
    { type: "model-output", turnId: "b", output: "Okay" },
    speech("assistant", "started", 2),
    transcript("assistant", "Okay.", true),
  );
  assert.equal(s.messages.length, 3);
  assert.equal(s.messages[0].text, "Your order was cancelled");
  assert.equal(s.messages[0].status, "interrupted");
  assert.equal(s.messages[2].text, "Okay.");
});
