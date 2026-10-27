import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const secret = process.env.VAPI_WEBHOOK_SECRET;
if (!secret) throw new Error("Set VAPI_WEBHOOK_SECRET");
const body = {
  message: {
    type: "tool-calls",
    toolCallList: [
      {
        id: "smoke-one",
        function: {
          name: "lookup_order",
          arguments: { orderNumber: "SEI-1001" },
        },
      },
      {
        id: "smoke-two",
        function: { name: "check_inventory", arguments: { productId: "P-04" } },
      },
    ],
  },
};
async function send(mode: string, authorized = true) {
  return fetch(base + "/api/tools/webhook?mode=" + mode, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorized ? { Authorization: "Bearer " + secret } : {}),
    },
    body: JSON.stringify(body),
  });
}
assert.equal((await fetch(base)).status, 200);
assert.equal((await fetch(base + "/api/health")).status, 200);
assert.equal((await send("normal", false)).status, 401);
const normal = await send("normal");
assert.equal(normal.status, 200);
const data = await normal.json();
assert.deepEqual(
  data.results.map((r: { toolCallId: string }) => r.toolCallId),
  ["smoke-one", "smoke-two"],
);
assert.equal(JSON.parse(data.results[0].result).status, "shipped");
const error = await send("error");
assert.equal(error.status, 200);
assert.ok((await error.json()).results[0].error);
assert.equal((await send("http500")).status, 500);
const malformed = await send("malformed");
assert.equal(malformed.status, 200);
assert.ok(!(await malformed.json()).results);
assert.equal((await send("normal")).status, 200);
console.log(
  "HTTP smoke passed: website, health, Bearer auth, batched IDs, business error, malformed envelope, HTTP 500, and normal recovery. No paid voice call made.",
);
