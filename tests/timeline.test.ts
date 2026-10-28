import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyTimeline,
  normalizeEvent,
  relativeTime,
  shouldFollow,
  businessFields,
} from "../src/lib/timeline";
const input = (payload: unknown, receivedAt = 1000, event = "message") => ({
  payload,
  receivedAt,
  event,
});
const invocation = (id = "a") => ({
  id,
  function: { name: "lookup_order", arguments: '{"order_number":"123"}' },
});
test("partials and model tokens stay raw; final user and assistant text appear once", () => {
  let s = normalizeEvent(emptyTimeline(), input({}, 1000, "call-start"));
  s = normalizeEvent(
    s,
    input(
      { type: "speech-update", role: "user", status: "started", turn: 0 },
      1100,
    ),
  );
  for (let i = 0; i < 40; i++)
    s = normalizeEvent(
      s,
      input(
        {
          type: "transcript",
          role: "user",
          transcriptType: "partial",
          transcript: "Check",
        },
        1200 + i,
      ),
    );
  s = normalizeEvent(
    s,
    input(
      {
        type: "transcript",
        role: "user",
        transcriptType: "final",
        transcript: "Check order 123",
      },
      1400,
    ),
  );
  s = normalizeEvent(
    s,
    input(
      { type: "speech-update", role: "assistant", status: "started" },
      1500,
    ),
  );
  s = normalizeEvent(
    s,
    input({ type: "model-output", output: "tokens" }, 1600),
  );
  s = normalizeEvent(
    s,
    input(
      {
        type: "transcript",
        role: "assistant",
        transcriptType: "final",
        transcript: "Your boots were delivered.",
      },
      1700,
    ),
  );
  assert.equal(s.entries.length, 3);
  assert.equal(s.raw.length, 46);
  assert.equal(s.entries[1].text, "Check order 123");
  assert.equal(s.entries[2].text, "Your boots were delivered.");
  assert.equal(s.live, "");
  assert.equal(s.entries[1].raw.length, 2);
});
test("tool invocation and forwarded result correlate by ID with actual arguments and business data", () => {
  let s = normalizeEvent(
    emptyTimeline(),
    input({ type: "tool-calls", toolCallList: [invocation()] }),
  );
  s = normalizeEvent(
    s,
    input(
      {
        type: "tool-calls-result",
        toolCallResult: {
          toolCallId: "a",
          result: '{"status":"delivered","product":"Snowboard boots"}',
          metadata: { durationMs: 123 },
        },
      },
      2000,
    ),
  );
  assert.equal(s.entries.length, 1);
  const e = s.entries[0];
  assert.equal(e.status, "success");
  assert.deepEqual(e.args, { order_number: "123" });
  assert.deepEqual(e.result, {
    status: "delivered",
    product: "Snowboard boots",
  });
  assert.equal(e.durationMs, 123);
  assert.equal(e.httpStatus, undefined);
  assert.equal(e.raw.length, 2);
});
test("history recovers server tool calls and results without replaying speech or duplicating tools", () => {
  const message = {
    type: "conversation-update",
    messages: [
      { role: "bot", toolCalls: [invocation()] },
      {
        role: "tool_call_result",
        toolCallId: "a",
        name: "lookup_order",
        result: '{"status":"delivered"}',
      },
    ],
    messagesOpenAIFormatted: [
      { role: "assistant", tool_calls: [invocation()] },
      { role: "tool", tool_call_id: "a", content: '{"status":"delivered"}' },
    ],
  };
  let s = normalizeEvent(emptyTimeline(), input(message));
  s = normalizeEvent(s, input(message, 2000));
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].status, "success");
  assert.equal(s.raw.length, 2);
});
test("business missing order, explicit HTTP500, and generic tool failure retain distinct evidence", () => {
  for (const [result, category, status] of [
    [
      {
        error:
          "Order 999 was not found. Ask the caller to verify the three digits separately.",
      },
      "Business error",
      undefined,
    ],
    [
      { error: "Service unavailable", metadata: { httpStatus: 500 } },
      "HTTP error",
      500,
    ],
    [
      { error: "Unable to execute" },
      "Tool error · cause not identified",
      undefined,
    ],
    [
      { error: "Bad response", metadata: { errorType: "protocol" } },
      "Tool protocol error",
      undefined,
    ],
    [
      { error: "Fetch failed", metadata: { errorType: "network" } },
      "Network error",
      undefined,
    ],
  ] as const) {
    const s = normalizeEvent(
      emptyTimeline(),
      input({
        type: "tool-calls-result",
        toolCallResult: { toolCallId: "a", ...result },
      }),
    );
    assert.equal(s.entries[0].status, "error");
    assert.equal(s.entries[0].category, category);
    assert.equal(s.entries[0].httpStatus, status);
  }
});
test("unobserved and uncorrelated results never establish success, failure, or duration", () => {
  let s = normalizeEvent(
    emptyTimeline(),
    input({
      type: "tool-calls",
      toolCallList: [invocation("a"), invocation("b")],
    }),
  );
  s = normalizeEvent(
    s,
    input(
      { type: "tool-calls-result", toolCallResult: { result: "delivered" } },
      2000,
    ),
  );
  assert.equal(s.entries[0].status, "pending");
  assert.equal(s.entries[1].status, "pending");
  s = normalizeEvent(s, input({}, 3000, "call-end"));
  assert.equal(s.entries[0].status, "unknown");
  assert.equal(s.entries[0].durationMs, undefined);
});
test("explicit interruptions and call errors surface without inferring an interruption from overlapping speech", () => {
  let s = normalizeEvent(
    emptyTimeline(),
    input({ type: "speech-update", role: "user", status: "started" }),
  );
  assert.equal(s.entries.filter((e) => e.kind === "interruption").length, 0);
  s = normalizeEvent(s, input({ type: "user-interrupted" }));
  s = normalizeEvent(
    s,
    input(
      { message: "Connection failed", response: { status: 503 } },
      2000,
      "error",
    ),
  );
  assert.equal(s.entries[1].title, "Assistant interrupted");
  assert.equal(s.entries[2].error, "Connection failed");
  assert.equal(s.entries[2].httpStatus, 503);
});
test("new calls reset raw evidence; timestamps and scroll follow respect inspection", () => {
  assert.deepEqual(emptyTimeline().raw, []);
  assert.equal(relativeTime(2250, 1000), "+00:01.3");
  assert.equal(relativeTime(1000, null), "Before connection");
  assert.equal(shouldFollow(800, 200, 1000), true);
  assert.equal(shouldFollow(0, 200, 1000), false);
  assert.deepEqual(
    businessFields({ eligible: false, status: "delivered", items: [] }),
    [
      ["Eligible", "false"],
      ["Status", "delivered"],
    ],
  );
});

test("timeline renders business data and errors with JSON inside collapsed technical details", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ExecutionTimeline } =
    await import("../src/components/execution-timeline");
  let s = normalizeEvent(
    emptyTimeline(),
    input({ type: "tool-calls", toolCallList: [invocation()] }),
  );
  s = normalizeEvent(
    s,
    input({
      type: "tool-calls-result",
      toolCallResult: {
        toolCallId: "a",
        result: '{"status":"delivered","product":"Snowboard boots"}',
      },
    }),
  );
  const html = renderToStaticMarkup(
    createElement(ExecutionTimeline, { timeline: s, callId: "verified-call" }),
  );
  assert.match(html, /Execution timeline/);
  assert.match(html, /Snowboard boots/);
  assert.match(html, /Success/);
  assert.match(html, /Technical details/);
  assert.match(html, /Raw Events/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.doesNotMatch(html, /raw-call-events/);
  assert.match(html, /calls\/verified-call/);
});

test("native Query tool events retain real IDs, arguments and forwarded results without adding a backend tool", async () => {
  // Representative installed-SDK ToolCall / ToolCallResult shapes; not live retrieval evidence.
  const call = {
    id: "query-fixture",
    type: "function",
    function: {
      name: "search_sei_guides",
      arguments: '{"query":"How should snowboard boots fit?"}',
    },
  };
  let s = normalizeEvent(
    emptyTimeline(),
    input({ type: "tool-calls", toolCallList: [call] }),
  );
  assert.equal(s.entries[0].title, "search_sei_guides");
  assert.equal(s.entries[0].status, "pending");
  assert.deepEqual(s.entries[0].args, {
    query: "How should snowboard boots fit?",
  });
  assert.equal(s.entries[0].result, undefined);
  const result = {
    matches: [
      { document: "SEI-SNOW-001", text: "Synthetic retrieval fixture only." },
    ],
  };
  s = normalizeEvent(
    s,
    input({
      type: "tool-calls-result",
      toolCallResult: {
        name: "search_sei_guides",
        toolCallId: call.id,
        result: JSON.stringify(result),
      },
    }),
  );
  assert.equal(s.entries[0].id, "tool-query-fixture");
  assert.equal(s.entries[0].status, "success");
  assert.deepEqual(s.entries[0].result, result);
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ExecutionTimeline } =
    await import("../src/components/execution-timeline");
  const html = renderToStaticMarkup(
    createElement(ExecutionTimeline, { timeline: s, callId: "" }),
  );
  assert.match(html, /Tool: search_sei_guides/);
  assert.match(html, /Synthetic retrieval fixture only/);
  assert.match(html, /Technical details/);
  assert.doesNotMatch(html, /<details[^>]*open/);
});

test("native Query calls in conversation history correlate without duplicate or invented results", () => {
  const call = {
    id: "query-history",
    type: "function",
    function: { name: "search_sei_guides", arguments: '{"query":"bindings"}' },
  };
  const history = {
    type: "conversation-update",
    messagesOpenAIFormatted: [
      { role: "assistant", tool_calls: [call] },
      {
        role: "tool",
        tool_call_id: call.id,
        content: "Synthetic query history result",
      },
    ],
  };
  let s = normalizeEvent(emptyTimeline(), input(history));
  s = normalizeEvent(s, input(history));
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].title, "search_sei_guides");
  assert.equal(s.entries[0].result, "Synthetic query history result");
  const dialogueOnly = normalizeEvent(
    emptyTimeline(),
    input({
      type: "transcript",
      role: "assistant",
      transcriptType: "final",
      transcript: "I found the guide with search_sei_guides.",
    }),
  );
  assert.equal(dialogueOnly.entries.filter((e) => e.kind === "tool").length, 0);
});

test("Product Guides render the actual order-123 scenario and copyable questions with a secure source link", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { DemoGuide } = await import("../src/components/demo-guide");
  const { orders, products } = await import("../src/lib/business");
  const { tools } = await import("../src/lib/catalog");
  assert.equal("search_sei_guides" in tools, false);
  const html = renderToStaticMarkup(
    createElement(DemoGuide, { orders, products }),
  );
  assert.match(html, /Product Guides/);
  assert.match(html, /order 123 \(Snowboard boots · delivered\)/);
  assert.match(html, /How should they fit/);
  assert.match(html, /What are snowboard bindings/);
  assert.match(html, /first ride/);
  assert.match(html, /Requires the article uploaded/);
  assert.match(
    html,
    /href="https:\/\/github.com\/bhanukhanijau\/sei-voice-ai-lab\/blob\/main\/docs\/snowboardGuide.md" target="_blank" rel="noopener noreferrer"/,
  );
});
