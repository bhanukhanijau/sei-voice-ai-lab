"use client";
import { useState } from "react";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  RotateCcw,
  Backpack,
  SearchX,
} from "lucide-react";
export type OrderReference = {
  order_number: string;
  status: string;
  product: string;
};
export type ProductReference = {
  product_name: string;
  variants: { size: string; color: string; quantity: number }[];
};
const scenarios = [
  {
    name: "Order tracking",
    icon: Package,
    description:
      "Ask about the shipping or delivery status of one of the sample orders.",
    question: "Hey, can you tell me the status of order 123?",
  },
  {
    name: "Returns",
    icon: RotateCcw,
    description: "Find out whether an order is eligible for a return.",
    question: "Can I return order 123?",
  },
  {
    name: "Product availability",
    icon: Backpack,
    description:
      "Ask whether an outdoor product is available in a particular size or color.",
    question: "Do you have snowboard boots in size 10?",
  },
  {
    name: "Troubleshooting",
    icon: SearchX,
    description:
      "Try an order number that doesn’t exist to see how the agent handles an unsuccessful lookup.",
    question: "Can you check order 999?",
  },
];
function ReferenceContent({
  orders,
  products,
}: {
  orders: OrderReference[];
  products: ProductReference[];
}) {
  const [tab, setTab] = useState("orders");
  return (
    <>
      <div className="reference-tabs" aria-label="Demo references">
        <button
          aria-pressed={tab === "orders"}
          onClick={() => setTab("orders")}
        >
          Sample orders
        </button>
        <button
          aria-pressed={tab === "products"}
          onClick={() => setTab("products")}
        >
          Products to ask about
        </button>
      </div>
      {tab === "orders" ? (
        <>
          <p className="reference-caption">
            These fictional orders are available for you to ask the agent about.
          </p>
          <div className="reference-records">
            {orders.map((o) => (
              <div className="order-record" key={o.order_number}>
                <strong>{o.order_number}</strong>
                <span>{o.product}</span>
                <small className={`order-status ${o.status}`}>
                  <i />
                  {o.status}
                </small>
              </div>
            ))}
            <div className="order-record missing">
              <strong>999</strong>
              <span>Not found</span>
              <small>Intentional test</small>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="reference-caption">
            Use the product name, then ask about a size or color.
          </p>
          <div className="product-records">
            {products.map((p) => {
              const available = p.variants.filter((v) => v.quantity > 0),
                unavailable = p.variants.filter((v) => v.quantity === 0);
              return (
                <div className="product-record" key={p.product_name}>
                  <strong>{p.product_name}</strong>
                  <span>
                    In stock:{" "}
                    {available.map((v) => `${v.size} ${v.color}`).join(" · ")}
                  </span>
                  {unavailable.length > 0 && (
                    <small>
                      Out of stock:{" "}
                      {unavailable
                        .map((v) => `${v.size} ${v.color}`)
                        .join(" · ")}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
export function DemoGuide({
  orders,
  products,
  active,
}: {
  orders: OrderReference[];
  products: ProductReference[];
  active: boolean;
}) {
  const [selected, setSelected] = useState(0),
    [copied, setCopied] = useState(false),
    [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? !active,
    scenario = scenarios[selected];
  return (
    <section
      className={`reviewer-guide ${expanded ? "" : "is-collapsed"}`}
      aria-label="Demo guide and references"
    >
      {expanded ? (
        <>
          <div className="getting-started">
            <div className="onboarding-heading">
              <h2>How to try the demo</h2>
              <button
                className="guide-toggle"
                onClick={() => setManualExpanded(false)}
                aria-expanded={true}
              >
                <ChevronUp size={14} />
                Hide guide
              </button>
            </div>
            <ol className="demo-steps">
              <li>
                <b>1</b>
                <span>
                  Click <strong>Start Call</strong> and allow microphone access.
                </span>
              </li>
              <li>
                <b>2</b>
                <span>
                  Ask about a sample <strong>order, return, or product.</strong>
                </span>
              </li>
              <li>
                <b>3</b>
                <span>
                  Watch the <strong>conversation and tools</strong> update in
                  real time.
                </span>
              </li>
            </ol>
            <div className="things-heading">
              <h3>Things to try</h3>
              <span>Say these aloud during a call.</span>
            </div>
            <div className="scenario-tabs" aria-label="Supported scenarios">
              {scenarios.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.name}
                    aria-pressed={selected === i}
                    onClick={() => {
                      setSelected(i);
                      setCopied(false);
                    }}
                  >
                    <Icon size={13} />
                    {s.name}
                  </button>
                );
              })}
            </div>
            <div className="scenario-detail">
              <p>{scenario.description}</p>
              <div className="scenario-question">
                <blockquote>“{scenario.question}”</blockquote>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(scenario.question);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  aria-label="Copy question"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="reference-card desktop-reference">
            <ReferenceContent orders={orders} products={products} />
          </div>
          <details className="reference-card mobile-reference">
            <summary>
              Sample orders & products
              <ChevronDown size={14} />
            </summary>
            <ReferenceContent orders={orders} products={products} />
          </details>
        </>
      ) : (
        <div className="collapsed-guide">
          <span>
            <strong>Demo guide</strong> · Ask about orders, returns, or outdoor
            gear.
          </span>
          <button
            className="guide-toggle"
            onClick={() => setManualExpanded(true)}
            aria-expanded={false}
          >
            <ChevronDown size={14} />
            Show guide & references
          </button>
        </div>
      )}
    </section>
  );
}
export function microphoneMessage(error: string) {
  return /permission|notallowed|denied/i.test(error)
    ? "Microphone access was blocked. Allow microphone access in your browser’s site settings, then start the call again."
    : /notfound|no.*microphone|device not found/i.test(error)
      ? "No microphone was found. Connect a microphone and start the call again."
      : error;
}
