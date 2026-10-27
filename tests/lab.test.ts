import test from "node:test";
import assert from "node:assert/strict";
import { executeBusiness } from "../src/lib/business";
import { tools } from "../src/lib/catalog";
import { handleToolCalls } from "../src/lib/engine";
import { GET, POST } from "../src/app/api/[...path]/route";
process.env.ADMIN_PASSWORD = "test-only-lab-password";
const call = (
  id: string,
  name = "lookup_order",
  args: unknown = { orderNumber: "SEI-1001" },
) => ({ id, type: "function", function: { name, arguments: args } });
const payload = (calls = [call("one")]) => ({
  message: {
    type: "tool-calls",
    call: { id: "local-test-not-provider" },
    toolCallList: calls,
  },
});
const req = (path: string, body?: unknown, auth = "") =>
  new Request("http://localhost/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
test("four mock business functions return expected hardcoded data", () => {
  for (const [name, t] of Object.entries(tools))
    assert.ok(executeBusiness(name as keyof typeof tools, t.example));
  assert.equal(
    (
      executeBusiness("lookup_order", { orderNumber: "SEI-1001" }) as {
        status: string;
      }
    ).status,
    "shipped",
  );
  assert.equal(
    (
      executeBusiness("check_inventory", { productId: "P-04" }) as {
        quantity: number;
      }
    ).quantity,
    0,
  );
});
test("return eligibility rejects old and undelivered orders", () => {
  assert.equal(
    (
      executeBusiness(
        "check_return_eligibility",
        { orderNumber: "SEI-1003" },
        new Date("2026-10-27"),
      ) as { eligible: boolean }
    ).eligible,
    false,
  );
  assert.equal(
    (
      executeBusiness("check_return_eligibility", {
        orderNumber: "SEI-1001",
      }) as { eligible: boolean }
    ).eligible,
    false,
  );
});
test("multiple calls preserve exact IDs and serialize result strings", async () => {
  const r = await handleToolCalls(
    payload([
      call("first"),
      call("second", "check_inventory", { productId: "P-04" }),
    ]),
  );
  assert.equal(r.status, 200);
  const rows = (r.body as { results: { toolCallId: string; result: string }[] })
    .results;
  assert.deepEqual(
    rows.map((r) => r.toolCallId),
    ["first", "second"],
  );
  assert.equal(JSON.parse(rows[0].result).status, "shipped");
});
test("string arguments accepted; invalid args and unknown tools return correlated errors", async () => {
  for (const args of [{}, "{", null]) {
    const r = await handleToolCalls(
      payload([call("bad", "lookup_order", args)]),
    );
    assert.equal(r.status, 200);
    assert.ok((r.body as { results: { error: string }[] }).results[0].error);
  }
  const good = await handleToolCalls(
    payload([call("str", "lookup_order", '{"orderNumber":"SEI-1001"}')]),
  );
  assert.match(JSON.stringify(good.body), /shipped/);
  const unknown = await handleToolCalls(payload([call("bad", "unknown", {})]));
  assert.match(JSON.stringify(unknown.body), /Unknown SEI tool/);
});
test("missing order is a valid business error, not an HTTP failure", async () => {
  const r = await handleToolCalls(
    payload([call("missing", "lookup_order", { orderNumber: "SEI-9999" })]),
  );
  assert.equal(r.status, 200);
  assert.match(JSON.stringify(r.body), /Order not found/);
});
test("each query mode changes actual webhook HTTP response and has no persisted effect", async () => {
  const error = await POST(req("tools/webhook?mode=error", payload()));
  assert.equal(error.status, 200);
  assert.match(JSON.stringify(await error.json()), /temporarily unavailable/);
  const bad = await POST(req("tools/webhook?mode=malformed", payload()));
  assert.equal(bad.status, 200);
  assert.ok(!(await bad.json()).results);
  assert.equal(
    (await POST(req("tools/webhook?mode=http500", payload()))).status,
    500,
  );
  const normal = await POST(req("tools/webhook?mode=normal", payload()));
  assert.equal(normal.status, 200);
  assert.match(JSON.stringify(await normal.json()), /shipped/);
});
test("fictional webhook is public while lab config and debugger keep the shared password", async () => {
  assert.equal((await POST(req("tools/webhook", payload()))).status, 200);
  assert.equal((await GET(req("config"))).status, 401);
  assert.equal((await POST(req("test", payload()))).status, 401);
  const basic =
    "Basic " + Buffer.from("lab:test-only-lab-password").toString("base64");
  assert.equal((await GET(req("config", undefined, basic))).status, 200);
  assert.equal((await POST(req("test", payload(), basic))).status, 200);
  assert.equal((await GET(req("health"))).status, 200);
});
test("malformed requests, invalid modes, duplicate IDs and invalid JSON are rejected", async () => {
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
  const invalid = new Request("http://localhost/api/tools/webhook", {
    method: "POST",
    body: "{",
  });
  assert.equal((await POST(invalid)).status, 400);
});
test("slow mode actually waits eight seconds", async () => {
  const start = Date.now();
  const r = await handleToolCalls(payload(), "slow");
  assert.equal(r.status, 200);
  assert.ok(Date.now() - start >= 7900);
});
