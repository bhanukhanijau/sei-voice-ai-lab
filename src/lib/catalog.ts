import { z } from "zod";
const text = z.string().trim().min(1).max(100);
export const tools = {
  lookup_order: {
    description:
      "Look up a fictional SEI order by order number. Ask for the order number first; never guess it.",
    schema: z.object({ orderNumber: text }),
    example: { orderNumber: "SEI-1001" },
  },
  check_return_eligibility: {
    description:
      "Check the fictional 90-day return policy for an order before offering a return.",
    schema: z.object({ orderNumber: text }),
    example: { orderNumber: "SEI-1002" },
  },
  check_inventory: {
    description:
      "Check fictional product stock by product ID. Ask for the product ID if unknown.",
    schema: z.object({ productId: text }),
    example: { productId: "P-04" },
  },
  get_membership_details: {
    description:
      "Retrieve a fictional customer membership and benefits by customer ID.",
    schema: z.object({ customerId: text }),
    example: { customerId: "C-01" },
  },
};
export type ToolName = keyof typeof tools;
export const modes = [
  "normal",
  "error",
  "slow",
  "malformed",
  "http500",
] as const;
export type Mode = (typeof modes)[number];
export const modeDescriptions: Record<Mode, string> = {
  normal: "Return the real mock business result.",
  error:
    "HTTP 200 with a correlated tool error. The assistant should acknowledge that the lookup failed.",
  slow: "Wait 8 seconds, then return the normal result. Set the Vapi tool timeout below 8 seconds to practice a timeout.",
  malformed: "HTTP 200 with an intentionally invalid Vapi response envelope.",
  http500: "Return a genuine HTTP 500 instead of a tool result.",
};
export function toolConfigs(base: string, mode: Mode = "normal") {
  return Object.entries(tools).map(([name, t]) => ({
    type: "function",
    function: {
      name,
      description: t.description,
      parameters: z.toJSONSchema(t.schema),
    },
    server: {
      url: `${base}/api/tools/webhook?mode=${mode}`,
      timeoutSeconds: 20,
    },
    messages: [
      { type: "request-start", content: "Let me check that for you." },
      {
        type: "request-failed",
        content: "I could not retrieve that information. Please try again.",
      },
    ],
  }));
}
