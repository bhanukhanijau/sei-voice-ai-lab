import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const calls = [
  ["lookup_order", { order_number: "123" }],
  ["lookup_order", { order_number: "234" }],
  ["lookup_order", { order_number: "345" }],
  ["lookup_order", { order_number: "456" }],
  ["lookup_order", { order_number: "567" }],
  ["check_return_eligibility", { order_number: "123" }],
  ["check_return_eligibility", { order_number: "345" }],
  [
    "check_inventory",
    { product_name: "Snowboard boots", size: "10", color: "Black" },
  ],
  ["check_inventory", { product_name: "Ski jacket", size: "M", color: "Blue" }],
  ["lookup_order", { order_number: "999" }],
  ["lookup_order", { order_number: "one hundred twenty three" }],
  ["lookup_order", { orderNumber: "123" }],
];
const body = {
  message: {
    type: "tool-calls",
    toolCallList: calls.map(([name, args], i) => ({
      id: "smoke-" + i,
      function: { name, arguments: args },
    })),
  },
};
async function send(mode: string) {
  return fetch(base + "/api/tools/webhook?mode=" + mode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
assert.equal((await fetch(base)).status, 200);
assert.equal((await fetch(base + "/api/health")).status, 200);
const config = await fetch(base + "/api/config");
assert.equal(config.status, 200);
assert.equal((await config.json()).tools.length, 4);
const debuggerResponse = await fetch(base + "/api/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
assert.equal(debuggerResponse.status, 200);
const normal = await send("normal");
assert.equal(normal.status, 200);
const data = (await normal.json()).results;
assert.deepEqual(
  data.map((r: { toolCallId: string }) => r.toolCallId),
  calls.map((_, i) => "smoke-" + i),
);
const result = (i: number) => JSON.parse(data[i].result);
assert.deepEqual(
  [0, 1, 2, 3, 4].map((i) => result(i).status),
  ["delivered", "processing", "shipped", "delayed", "cancelled"],
);
assert.equal(result(5).eligible, true);
assert.equal(result(6).eligible, false);
assert.equal(result(7).quantity_available, 6);
assert.equal(result(8).in_stock, false);
assert.match(data[9].error, /not found/);
assert.equal(result(10).order_number, "123");
assert.equal(result(11).order_number, "123");
const error = await send("error");
assert.equal(error.status, 200);
assert.ok(
  (await error.json()).results.every((r: { error: string }) => r.error),
);
assert.equal((await send("http500")).status, 500);
const malformed = await send("malformed");
assert.equal(malformed.status, 200);
assert.ok(!(await malformed.json()).results);
assert.equal((await send("normal")).status, 200);
console.log(
  "HTTP smoke passed: five order states, returns, inventory variants, missing order 999, spoken normalization, legacy argument compatibility, batched IDs, password-free access and error modes. No paid voice call made.",
);
