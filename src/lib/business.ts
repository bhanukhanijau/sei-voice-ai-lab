import { z } from "zod";
import { tools, type ToolName } from "./catalog";
import { orderNumberFromArguments } from "./order-number";
export const sandboxDate = "2026-10-27";
export const returnPolicy = {
  window_days: 30,
  condition: "Unused gear in original condition",
  as_of: sandboxDate,
};
type Order = {
  order_number: string;
  status: "delivered" | "processing" | "shipped" | "delayed" | "cancelled";
  product: string;
  order_date: string;
  shipping_status: string;
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  original_estimated_delivery?: string;
  delivered_date?: string;
  payment_status: string;
  cancelled_date?: string;
  cancellation_reason?: string;
  refund_status?: string;
  refund_amount?: number;
  refund_currency?: string;
  refund_expected_date?: string;
};
export const orders: Order[] = [
  {
    order_number: "123",
    status: "delivered",
    product: "Snowboard boots",
    order_date: "2026-10-14",
    payment_status: "paid",
    shipping_status: "Delivered successfully",
    shipping_carrier: "UPS (fictional)",
    tracking_number: "MOCK-123-UPS",
    delivered_date: "2026-10-20",
  },
  {
    order_number: "234",
    status: "processing",
    product: "Hiking backpack",
    order_date: "2026-10-26",
    payment_status: "accepted",
    shipping_status: "Payment accepted; preparing shipment",
    estimated_delivery: "2026-10-31",
  },
  {
    order_number: "345",
    status: "shipped",
    product: "Camping tent",
    order_date: "2026-10-21",
    payment_status: "paid",
    shipping_status: "In transit",
    shipping_carrier: "FedEx (fictional)",
    tracking_number: "MOCK-345-FDX",
    estimated_delivery: "2026-10-29",
  },
  {
    order_number: "456",
    status: "delayed",
    product: "Ski jacket",
    order_date: "2026-10-19",
    payment_status: "paid",
    shipping_status: "Carrier delay; revised delivery estimate",
    shipping_carrier: "UPS (fictional)",
    tracking_number: "MOCK-456-UPS",
    original_estimated_delivery: "2026-10-25",
    estimated_delivery: "2026-11-02",
  },
  {
    order_number: "567",
    status: "cancelled",
    product: "Snowboard",
    order_date: "2026-10-22",
    payment_status: "refund_pending",
    shipping_status: "Cancelled before shipment",
    cancelled_date: "2026-10-23",
    cancellation_reason: "Customer requested cancellation",
    refund_status: "pending",
    refund_amount: 429,
    refund_currency: "USD",
    refund_expected_date: "2026-10-30",
  },
];
export const products = [
  {
    id: "P-01",
    product_name: "Snowboard boots",
    aliases: ["boots", "summit snowboard boots"],
    variants: [
      { size: "9", color: "Black", quantity: 4 },
      { size: "10", color: "Black", quantity: 6 },
      { size: "11", color: "Black", quantity: 0 },
      { size: "10", color: "Gray", quantity: 2 },
    ],
  },
  {
    id: "P-03",
    product_name: "Hiking backpack",
    aliases: ["backpack", "trailhead backpack"],
    variants: [
      { size: "30 L", color: "Green", quantity: 12 },
      { size: "45 L", color: "Black", quantity: 8 },
    ],
  },
  {
    id: "P-04",
    product_name: "Camping tent",
    aliases: ["tent", "basecamp tent"],
    variants: [
      { size: "2-person", color: "Orange", quantity: 2 },
      { size: "4-person", color: "Green", quantity: 1 },
    ],
  },
  {
    id: "P-06",
    product_name: "Ski jacket",
    aliases: ["jacket", "stormline jacket"],
    variants: [
      { size: "S", color: "Blue", quantity: 3 },
      { size: "M", color: "Blue", quantity: 0 },
      { size: "L", color: "Black", quantity: 0 },
      { size: "L", color: "Blue", quantity: 2 },
    ],
  },
  {
    id: "P-08",
    product_name: "Snowboard",
    aliases: ["summit snowboard"],
    variants: [
      { size: "152 cm", color: "Black", quantity: 2 },
      { size: "156 cm", color: "Black", quantity: 1 },
      { size: "160 cm", color: "Black", quantity: 0 },
    ],
  },
];
export const customers = [
  {
    id: "C-01",
    name: "Alex Morgan",
    email: "alex@example.invalid",
    tier: "Summit",
  },
  {
    id: "C-02",
    name: "Jordan Rivera",
    email: "jordan@example.invalid",
    tier: "Trail",
  },
  { id: "C-03", name: "Sam Chen", email: "sam@example.invalid", tier: "Guest" },
];
export class BusinessError extends Error {}
function findOrder(raw: unknown) {
  const number = orderNumberFromArguments(raw);
  const order = orders.find((o) => o.order_number === number);
  if (!order)
    throw new BusinessError(
      `Order ${number} was not found. Ask the caller to verify the three digits separately.`,
    );
  return order;
}
function eligibility(order: Order) {
  const base = {
    order_number: order.order_number,
    eligible: false,
    reason: "",
    next_step: "",
    policy: returnPolicy,
  };
  if (order.status === "cancelled")
    return {
      ...base,
      reason: "This order was cancelled and cannot be returned.",
      next_step: `No return is needed. The refund is ${order.refund_status}; expected ${order.refund_expected_date}.`,
    };
  if (!order.delivered_date)
    return {
      ...base,
      reason:
        order.status === "processing"
          ? "The order has not shipped yet."
          : order.status === "shipped"
            ? "The order is still in transit."
            : "The order is delayed and has not been delivered.",
      next_step: "Wait until delivery, then check return eligibility again.",
    };
  const deadline = new Date(
    Date.parse(order.delivered_date + "T00:00:00Z") +
      returnPolicy.window_days * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const eligible =
    sandboxDate >= order.delivered_date && sandboxDate <= deadline;
  return {
    ...base,
    eligible,
    return_deadline: deadline,
    reason: eligible
      ? "Within the 30-day return window; gear must be unused and in original condition."
      : "Outside the 30-day return window.",
    next_step: eligible
      ? "Keep the item unused and request a return before the deadline. This tool only checks eligibility."
      : "Contact SEI support to discuss options.",
  };
}
const token = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const sizeToken = (s: string) =>
  token(s)
    .replace(/^us\s*/, "")
    .replace(/\s*cm$/, "")
    .replace(/\s+/g, "");
function inventory(raw: unknown) {
  // Keep old productId callers working, but advertise name/size/color in Vapi.
  const args = z
    .object({
      product_name: z.string().trim().min(1).max(100).optional(),
      productId: z.string().optional(),
      size: z.string().trim().min(1).max(30).optional(),
      color: z.string().trim().min(1).max(30).optional(),
    })
    .parse(raw);
  if (!args.product_name && !args.productId)
    throw new BusinessError(
      "Missing product_name. Ask which product the caller wants before checking stock.",
    );
  const product = args.product_name
    ? products.find((p) =>
        [p.product_name, ...p.aliases].some(
          (n) => token(n) === token(args.product_name!),
        ),
      )
    : products.find((p) => p.id === args.productId);
  if (!product)
    throw new BusinessError(
      "Product not found. Ask for snowboard boots, hiking backpack, camping tent, ski jacket, or snowboard.",
    );
  const matching = product.variants.filter(
    (v) =>
      (!args.size || sizeToken(v.size) === sizeToken(args.size)) &&
      (!args.color || token(v.color) === token(args.color)),
  );
  const quantity = matching.reduce((n, v) => n + v.quantity, 0);
  return {
    product_name: product.product_name,
    ...(args.size ? { requested_size: args.size } : {}),
    ...(args.color ? { requested_color: args.color } : {}),
    in_stock: quantity > 0,
    quantity_available: quantity,
    reason: !matching.length
      ? "That size/color combination is not offered."
      : quantity === 0
        ? "The requested variant is out of stock."
        : quantity <= 3
          ? "Low stock."
          : "In stock.",
    available_variants: product.variants.filter((v) => v.quantity > 0),
    ...(!quantity
      ? { alternatives: product.variants.filter((v) => v.quantity > 0) }
      : {}),
  };
}
export function executeBusiness(name: ToolName, raw: unknown) {
  if (name === "lookup_order") {
    const order = findOrder(raw),
      returns = eligibility(order);
    return {
      ...order,
      return_eligible: returns.eligible,
      ...("return_deadline" in returns
        ? { return_deadline: returns.return_deadline }
        : {}),
      as_of: sandboxDate,
    };
  }
  if (name === "check_return_eligibility") return eligibility(findOrder(raw));
  if (name === "check_inventory") return inventory(raw);
  const args = tools.get_membership_details.schema.parse(raw);
  const c = customers.find((c) => c.id === args.customerId);
  if (!c) throw new BusinessError("Customer not found");
  return {
    ...c,
    benefits:
      c.tier === "Summit"
        ? ["Free standard shipping", "Gear clinics"]
        : c.tier === "Trail"
          ? ["Gear clinics"]
          : [],
  };
}
