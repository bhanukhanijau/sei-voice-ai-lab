import { tools, type ToolName } from "./catalog";
export const products = [
  [
    "P-01",
    "Summit All-Mountain Snowboard",
    "snowboard",
    429,
    12,
    "156 cm directional twin; medium flex. Have binding torque checked by a qualified technician.",
  ],
  [
    "P-02",
    "Ridge Touring Skis",
    "skis",
    649,
    4,
    "172 cm; 96 mm waist. Professional binding setup required.",
  ],
  [
    "P-03",
    "Trailhead 45 Backpack",
    "hiking backpack",
    189,
    21,
    "45 L; adjustable torso 17–21 inches; 1.4 kg.",
  ],
  [
    "P-04",
    "Basecamp 2 Tent",
    "camping tent",
    259,
    0,
    "Two person; three season; 2.1 kg; seam-sealed fly.",
  ],
  [
    "P-05",
    "Pinecrest Hiking Boots",
    "footwear",
    159,
    9,
    "Waterproof mid boot; try with hiking socks; allow toe room.",
  ],
  [
    "P-06",
    "Stormline Rain Shell",
    "outdoor clothing",
    139,
    18,
    "Three-layer waterproof shell; wash cold; no fabric softener.",
  ],
  [
    "P-07",
    "Frostline Sleeping Bag",
    "camping",
    199,
    7,
    "20°F ISO comfort rating; synthetic insulation.",
  ],
  [
    "P-08",
    "Switchback Snowboard Bindings",
    "snowboard",
    219,
    6,
    "Medium size US 8–11; verify board mounting compatibility.",
  ],
].map(([id, name, category, price, stock, specs]) => ({
  id: String(id),
  name: String(name),
  category: String(category),
  price: Number(price),
  stock: Number(stock),
  specs: String(specs),
}));
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
export const orders = [
  {
    orderNumber: "SEI-1001",
    customerId: "C-01",
    productId: "P-01",
    status: "shipped",
    orderedAt: "2026-10-20",
    deliveredAt: null,
    estimatedDelivery: "2026-10-29",
    tracking: "MOCK-TRACK-1001",
  },
  {
    orderNumber: "SEI-1002",
    customerId: "C-02",
    productId: "P-05",
    status: "delivered",
    orderedAt: "2026-10-10",
    deliveredAt: "2026-10-15",
    estimatedDelivery: null,
    tracking: "MOCK-TRACK-1002",
  },
  {
    orderNumber: "SEI-1003",
    customerId: "C-03",
    productId: "P-04",
    status: "delivered",
    orderedAt: "2025-01-01",
    deliveredAt: "2025-01-05",
    estimatedDelivery: null,
    tracking: "MOCK-TRACK-1003",
  },
  {
    orderNumber: "SEI-1004",
    customerId: "C-01",
    productId: "P-03",
    status: "processing",
    orderedAt: "2026-10-26",
    deliveredAt: null,
    estimatedDelivery: "2026-11-01",
    tracking: null,
  },
];
export class BusinessError extends Error {}
export function executeBusiness(
  name: ToolName,
  raw: unknown,
  now = new Date(),
) {
  const args = tools[name].schema.parse(raw) as Record<string, string>;
  const order = () => {
    const o = orders.find((o) => o.orderNumber === args.orderNumber);
    if (!o)
      throw new BusinessError(
        "Order not found. Ask the customer to verify the order number.",
      );
    return o;
  };
  const eligibility = () => {
    const o = order();
    const days = o.deliveredAt
      ? Math.floor((now.getTime() - Date.parse(o.deliveredAt)) / 86400000)
      : null;
    return {
      orderNumber: o.orderNumber,
      eligible: days !== null && days >= 0 && days <= 90,
      daysSinceDelivery: days,
      policy: "Returns within 90 days of delivery; unused gear only.",
      reason:
        days === null
          ? "Not delivered"
          : days > 90
            ? "Outside 90-day window"
            : "Within return window",
    };
  };
  switch (name) {
    case "lookup_order":
      return order();
    case "check_return_eligibility":
      return eligibility();
    case "check_inventory": {
      const product = products.find((p) => p.id === args.productId);
      if (!product) throw new BusinessError("Product not found");
      return {
        productId: product.id,
        name: product.name,
        available: product.stock > 0,
        quantity: product.stock,
      };
    }
    case "get_membership_details": {
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
  }
}
