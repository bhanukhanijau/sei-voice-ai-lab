import { NextResponse } from "next/server";
import { z } from "zod";
import { tools, modes, modeDescriptions, toolConfigs } from "@/lib/catalog";
import { handleToolCalls, parseMode } from "@/lib/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
const maxBodyBytes = 100_000;
async function readBoundedBody(req: Request) {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBodyBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
async function handle(req: Request) {
  const url = new URL(req.url),
    path = url.pathname.replace("/api/", "");
  if (path === "health") return json({ status: "ok", storage: "none" });
  const webhook = path === "tools/webhook";
  try {
    if (path === "config" && req.method === "GET") {
      // Read public SDK settings at runtime so Vercel environment updates apply.
      const env = process.env;
      const base = (env.APP_BASE_URL || url.origin).replace(/\/$/, "");
      return json({
        publicKey: env["NEXT_PUBLIC_VAPI_PUBLIC_KEY"] || "",
        assistantId: env["NEXT_PUBLIC_VAPI_ASSISTANT_ID"] || "",
        baseUrl: base,
        tools: Object.entries(tools).map(([name, t]) => ({
          name,
          description: t.description,
          schema: z.toJSONSchema(t.schema),
          example: t.example,
        })),
        modes,
        modeDescriptions,
        configs: toolConfigs(base, "normal"),
      });
    }
    if ((webhook || path === "test") && req.method === "POST") {
      const mode = parseMode(url.searchParams.get("mode"));
      const text = await readBoundedBody(req);
      if (text === null) return json({ error: "Payload too large" }, 413);
      const payload = JSON.parse(text);
      const start = Date.now();
      const output = await handleToolCalls(payload, mode);
      const message = payload.message;
      console.info(
        "SEI mock tool request",
        JSON.stringify({
          callId: message.call?.id || null,
          toolCallIds: message.toolCallList.map((c: { id: string }) => c.id),
          tools: message.toolCallList.map(
            (c: { function: { name: string } }) => c.function.name,
          ),
          mode,
          status: output.status,
          durationMs: Date.now() - start,
          source: webhook ? "Function webhook" : "Local debugger test",
        }),
      );
      return json(output.body, output.status);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
    if (e instanceof z.ZodError)
      return json(
        { error: "Invalid webhook payload or mode", details: e.issues },
        400,
      );
    return json(
      { error: e instanceof Error ? e.message : "Request failed" },
      400,
    );
  }
}
export const GET = handle;
export const POST = handle;
