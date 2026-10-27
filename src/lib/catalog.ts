import { z } from "zod";
const text = z.string().trim().min(1).max(100);
export const tools = {
  lookup_order: {
    description:
      "Look up a fictional SEI order using its three-digit order_number string. Ask the caller to say each digit separately if missing or unclear; never guess.",
    schema: z.object({
      order_number: text.describe(
        "Three-digit order number as a string, for example 123. Ask for separate digits if unclear.",
      ),
    }),
    example: { order_number: "123" },
  },
  check_return_eligibility: {
    description:
      "Check the 30-day return eligibility for a fictional SEI order using its three-digit order_number string. Use this tool for return questions; it does not create a return.",
    schema: z.object({
      order_number: text.describe(
        "Three-digit order number as a string, for example 123. Ask for separate digits if unclear.",
      ),
    }),
    example: { order_number: "123" },
  },
  check_inventory: {
    description:
      "Check fictional stock for a product_name, optionally narrowed by size and color. Ask which product is wanted; clarify variants before promising a particular size or color.",
    schema: z.object({
      product_name: text.describe(
        "Product name, such as snowboard boots, hiking backpack, camping tent, ski jacket, or snowboard.",
      ),
      size: text
        .optional()
        .describe("Requested size, such as 10, M, or 156 cm, if supplied."),
      color: text.optional().describe("Requested color, if supplied."),
    }),
    example: { product_name: "Snowboard boots", size: "10", color: "Black" },
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
