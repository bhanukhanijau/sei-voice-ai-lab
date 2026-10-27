import { z } from "zod";
import { tools, modes, type Mode, type ToolName } from "./catalog";
import { executeBusiness } from "./business";
const callSchema = z.object({
  id: z.string().min(1).max(300),
  function: z.object({
    name: z.string().min(1).max(100),
    arguments: z.unknown(),
  }),
});
const envelope = z.object({
  message: z
    .object({
      type: z.literal("tool-calls"),
      call: z.object({ id: z.string() }).passthrough().optional(),
      toolCallList: z.array(callSchema).min(1).max(20),
    })
    .passthrough(),
});
export function parseMode(raw: string | null): Mode {
  return z.enum(modes).parse(raw || "normal");
}
export async function handleToolCalls(payload: unknown, mode: Mode = "normal") {
  const data = envelope.parse(payload);
  const ids = data.message.toolCallList.map((c) => c.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate tool-call IDs");
  if (mode === "slow")
    await new Promise((resolve) => setTimeout(resolve, 8000));
  if (mode === "http500")
    return {
      status: 500,
      body: { error: "Injected HTTP 500 from the fictional SEI tool endpoint" },
    };
  if (mode === "malformed")
    return {
      status: 200,
      body: { unexpected: "Deliberately invalid Vapi response envelope" },
    };
  const results = data.message.toolCallList.map((c) => {
    try {
      if (!Object.hasOwn(tools, c.function.name))
        throw new Error("Unknown SEI tool");
      let args = c.function.arguments;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          throw new Error("Tool arguments are not valid JSON");
        }
      }
      if (mode === "error")
        throw new Error("SEI mock service temporarily unavailable (injected)");
      const output = executeBusiness(c.function.name as ToolName, args);
      return { toolCallId: c.id, result: JSON.stringify(output) };
    } catch (e) {
      return {
        toolCallId: c.id,
        error:
          e instanceof z.ZodError
            ? "Invalid tool arguments: " +
              e.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : e instanceof Error
              ? e.message
              : "Tool execution failed",
      };
    }
  });
  return { status: 200, body: { results } };
}
