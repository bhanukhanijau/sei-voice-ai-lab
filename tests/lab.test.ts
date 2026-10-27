import test from "node:test";
import assert from "node:assert/strict";
import {
  executeBusiness,
  orders,
  returnPolicy,
  sandboxDate,
} from "../src/lib/business";
import { tools, toolConfigs } from "../src/lib/catalog";
import {
  normalizeOrderNumber,
  orderNumberFromArguments,
} from "../src/lib/order-number";
import { handleToolCalls } from "../src/lib/engine";
import { GET, POST } from "../src/app/api/[...path]/route";
const call = (
  id: string,
  name = "lookup_order",
  args: unknown = { order_number: "123" },
) => ({ id, type: "function", function: { name, arguments: args } });
const payload = (calls = [call("one")]) => ({
  message: {
    type: "tool-calls",
    call: { id: "local-test-not-provider" },
    toolCallList: calls,
  },
});
const req = (path: string, body?: unknown) =>
  new Request("http://localhost/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const run = (name: keyof typeof tools, args: unknown) =>
  executeBusiness(name, args) as Record<string, unknown>;
const rows = (body: unknown) =>
  (
    body as {
      results: { toolCallId: string; result?: string; error?: string }[];
    }
  ).results;
test("spoken and written three-digit order numbers normalize safely", () => {
  for (const value of [
    "123",
    " 123 ",
    "one two three",
    "one hundred twenty three",
    "one hundred twenty-three",
    "one hundred and twenty three",
    "1 2 3",
  ])
    assert.equal(normalizeOrderNumber(value), "123");
  assert.equal(normalizeOrderNumber("nine hundred ninety nine"), "999");
  assert.equal(normalizeOrderNumber("one hundred"), "100");
  assert.equal(normalizeOrderNumber("one hundred three"), "103");
  assert.equal(normalizeOrderNumber("one zero three"), "103");
});
test("ambiguous inputs, arbitrary surrounding strings and numeric arguments are rejected", () => {
  for (const input of [
    123,
    null,
    {},
    "",
    "12",
    "1234",
    "order 123",
    "abc123xyz",
    "123 or 234",
    "1-2-3",
    "phone 555123",
    "one two",
    "one hundred and",
    "one hundred twenty thirteen",
    "twenty three",
    "constructor two three",
    "one two three please",
  ])
    assert.throws(() => normalizeOrderNumber(input), /three digits separately/);
});
test("explicit legacy aliases and the old orderNumber field remain compatible", () => {
  assert.equal(normalizeOrderNumber("SEI-1001"), "123");
  assert.equal(run("lookup_order", { orderNumber: "123" }).order_number, "123");
  assert.equal(
    run("lookup_order", { orderNumber: "SEI-1001" }).order_number,
    "123",
  );
  assert.equal(
    orderNumberFromArguments({
      order_number: "123",
      orderNumber: "one two three",
    }),
    "123",
  );
  assert.throws(
    () => orderNumberFromArguments({ order_number: "123", orderNumber: "234" }),
    /Conflicting/,
  );
  assert.throws(() => normalizeOrderNumber("SEI-1005"));
  assert.throws(() => normalizeOrderNumber("prefix SEI-1001"));
  assert.throws(() =>
    orderNumberFromArguments({ order_number: null, orderNumber: "123" }),
  );
  for (const [oldId, number] of [
    ["SEI-1001", "123"],
    ["SEI-1002", "234"],
    ["SEI-1003", "345"],
    ["SEI-1004", "456"],
  ])
    assert.equal(
      run("lookup_order", { orderNumber: oldId }).order_number,
      number,
    );
});
test("exactly five deterministic records have consistent status, dates and optional shipping fields", () => {
  assert.deepEqual(
    orders.map((o) => o.order_number),
    ["123", "234", "345", "456", "567"],
  );
  const statuses = [
    "delivered",
    "processing",
    "shipped",
    "delayed",
    "cancelled",
  ];
  orders.forEach((o, i) => {
    assert.equal(typeof o.order_number, "string");
    assert.equal(o.status, statuses[i]);
    assert.ok(o.order_date <= sandboxDate);
    assert.deepEqual(
      run("lookup_order", { order_number: o.order_number }),
      run("lookup_order", { order_number: o.order_number }),
    );
  });
  const delivered = run("lookup_order", { order_number: "123" });
  assert.equal(delivered.product, "Snowboard boots");
  assert.equal(delivered.delivered_date, "2026-10-20");
  assert.ok(!("estimated_delivery" in delivered));
  const processing = run("lookup_order", { order_number: "234" });
  assert.ok(!("tracking_number" in processing));
  const shipped = run("lookup_order", { order_number: "345" });
  assert.ok(shipped.tracking_number);
  assert.equal(shipped.estimated_delivery, "2026-10-29");
  const delayed = run("lookup_order", { order_number: "456" });
  assert.ok(
    String(delayed.estimated_delivery) >
      String(delayed.original_estimated_delivery),
  );
  const cancelled = run("lookup_order", { order_number: "567" });
  assert.equal(cancelled.refund_status, "pending");
  assert.ok(!("tracking_number" in cancelled));
});
test("return rules match each order, with a fixed 30-day window and no false eligibility", () => {
  assert.equal(returnPolicy.window_days, 30);
  for (const number of ["123", "234", "345", "456", "567"]) {
    const result = run("check_return_eligibility", { order_number: number });
    assert.equal(result.order_number, number);
    assert.equal(result.eligible, number === "123");
    assert.ok(result.reason);
    assert.ok(result.next_step);
    if (number === "123") assert.equal(result.return_deadline, "2026-11-19");
    else assert.ok(!("return_deadline" in result));
    assert.equal(
      run("lookup_order", { order_number: number }).return_eligible,
      result.eligible,
    );
  }
});
test("999 has no record and gives a correlated business error for lookup and returns", async () => {
  assert.ok(!orders.some((o) => o.order_number === "999"));
  for (const name of ["lookup_order", "check_return_eligibility"]) {
    const r = await handleToolCalls(
      payload([call("missing", name, { order_number: "999" })]),
    );
    assert.equal(r.status, 200);
    assert.equal(rows(r.body)[0].toolCallId, "missing");
    assert.match(rows(r.body)[0].error!, /999.*not found/);
  }
});
test("inventory handles partial filters, exact variants, limited stock, unavailable sizes and unknown products", () => {
  assert.equal(
    run("check_inventory", { product_name: "Hiking backpack" })
      .quantity_available,
    20,
  );
  assert.equal(
    run("check_inventory", { product_name: "Camping tent" }).quantity_available,
    3,
  );
  assert.equal(
    run("check_inventory", {
      product_name: "snowboard boots",
      size: "US 10",
      color: "black",
    }).quantity_available,
    6,
  );
  assert.equal(
    run("check_inventory", {
      product_name: "Ski jacket",
      size: "M",
      color: "Blue",
    }).in_stock,
    false,
  );
  const invalid = run("check_inventory", {
    product_name: "Snowboard boots",
    size: "99",
  });
  assert.equal(invalid.quantity_available, 0);
  assert.ok((invalid.alternatives as unknown[]).length);
  assert.equal(
    run("check_inventory", { product_name: "Snowboard", size: "156" })
      .quantity_available,
    1,
  );
  assert.throws(
    () =>
      run("check_inventory", {
        product_name: "snowboard boots or camping tent",
      }),
    /Product not found/,
  );
  assert.throws(() =>
    run("check_inventory", { product_name: "Boots", size: 10 }),
  );
});
test("all advertised functions validate their examples, including preserved membership", () => {
  for (const [name, t] of Object.entries(tools)) {
    assert.ok(t.schema.safeParse(t.example).success);
    assert.ok(run(name as keyof typeof tools, t.example));
  }
});
test("batch responses preserve each exact ID and success/error string envelope", async () => {
  const r = await handleToolCalls(
    payload([
      call("first"),
      call("second", "check_return_eligibility", { order_number: "123" }),
      call("third", "check_inventory", { product_name: "Camping tent" }),
      call("missing", "lookup_order", { order_number: "999" }),
    ]),
  );
  assert.equal(r.status, 200);
  const result = rows(r.body);
  assert.deepEqual(
    result.map((r) => r.toolCallId),
    ["first", "second", "third", "missing"],
  );
  assert.equal(JSON.parse(result[0].result!).order_number, "123");
  assert.equal(JSON.parse(result[1].result!).eligible, true);
  assert.equal(JSON.parse(result[2].result!).quantity_available, 3);
  assert.ok(result[3].error);
  for (const row of result)
    assert.equal(Number("result" in row) + Number("error" in row), 1);
});
test("string arguments accepted; invalid or numeric order arguments request clarification", async () => {
  const good = await handleToolCalls(
    payload([call("str", "lookup_order", '{"order_number":"one two three"}')]),
  );
  assert.equal(JSON.parse(rows(good.body)[0].result!).order_number, "123");
  for (const args of [
    {},
    "{",
    null,
    { order_number: 123 },
    { order_number: "123 or 234" },
  ]) {
    const r = await handleToolCalls(
      payload([call("bad", "lookup_order", args)]),
    );
    assert.equal(r.status, 200);
    assert.ok(rows(r.body)[0].error);
  }
  const unknown = await handleToolCalls(payload([call("bad", "unknown", {})]));
  assert.match(rows(unknown.body)[0].error!, /Unknown SEI tool/);
});
test("all three tools preserve business error, malformed and HTTP500 modes without persistent changes", async () => {
  for (const name of [
    "lookup_order",
    "check_return_eligibility",
    "check_inventory",
  ] as const) {
    const data = payload([call("mode", name, tools[name].example)]);
    for (const [mode, status] of [
      ["error", 200],
      ["malformed", 200],
      ["http500", 500],
    ] as const) {
      const r = await POST(req("tools/webhook?mode=" + mode, data));
      assert.equal(r.status, status);
      const b = await r.json();
      if (mode === "error")
        assert.match(b.results[0].error, /temporarily unavailable/);
      if (mode === "malformed") assert.ok(!b.results);
    }
    const normal = await POST(req("tools/webhook", data));
    assert.equal(normal.status, 200);
    assert.ok((await normal.json()).results[0].result);
  }
});
test("config advertises canonical schemas and exact public Function URLs without authentication", async () => {
  const config = await GET(req("config"));
  assert.equal(config.status, 200);
  const data = await config.json();
  assert.equal(data.tools.length, 4);
  assert.ok(!("VAPI_PRIVATE_API_KEY" in data));
  const definitions = toolConfigs("https://sei-voice-ai-lab.vercel.app");
  assert.deepEqual(definitions[0].function.parameters.required, [
    "order_number",
  ]);
  assert.deepEqual(definitions[1].function.parameters.required, [
    "order_number",
  ]);
  assert.deepEqual(definitions[2].function.parameters.required, [
    "product_name",
  ]);
  definitions.slice(0, 3).forEach((c) => {
    assert.equal(c.type, "function");
    assert.equal(
      c.server.url,
      "https://sei-voice-ai-lab.vercel.app/api/tools/webhook?mode=normal",
    );
    assert.ok(!("credentialId" in c.server));
  });
  assert.equal((await POST(req("test", payload()))).status, 200);
});
test("invalid webhook JSON, envelopes, modes and duplicate call IDs are rejected", async () => {
  assert.equal((await POST(req("tools/webhook", {}))).status, 400);
  assert.equal(
    (await POST(req("tools/webhook?mode=unknown", payload()))).status,
    400,
  );
  assert.equal(
    (await POST(req("tools/webhook", payload([call("dup"), call("dup")]))))
      .status,
    400,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/tools/webhook", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
    400,
  );
});
test("slow mode waits eight seconds and supports all three tools in one request", async () => {
  const start = Date.now();
  const r = await handleToolCalls(
    payload([
      call("a"),
      call("b", "check_return_eligibility", { order_number: "123" }),
      call("c", "check_inventory", { product_name: "Camping tent" }),
    ]),
    "slow",
  );
  assert.equal(r.status, 200);
  assert.equal(rows(r.body).length, 3);
  assert.ok(Date.now() - start >= 7900);
});
