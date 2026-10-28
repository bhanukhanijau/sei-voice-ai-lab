"use client";
import { useState } from "react";
import { Copy, Check, BookOpen, ChevronDown } from "lucide-react";
export type OrderReference = {
  order_number: string;
  status: string;
  product: string;
};
export type ProductReference = {
  product_name: string;
  variants: { size: string; color: string; quantity: number }[];
};
const questions = [
  "What’s the status of order 123?",
  "Can I return order 123?",
  "Do you have snowboard boots in size 10?",
  "Can you find order 999?",
];
export function DemoGuide({
  orders,
  products,
  id,
}: {
  orders: OrderReference[];
  products: ProductReference[];
  id?: string;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <section className="panel guide-panel" id={id}>
      <div className="panel-head">
        <div className="panel-label">
          <BookOpen size={15} />
          <h2>Demo guide & sample data</h2>
        </div>
      </div>
      <div
        className="guide-scroll"
        tabIndex={0}
        aria-label="Demo guide and sample data"
      >
        <section className="guide-section">
          <h3>How to use</h3>
          <ol className="guide-steps">
            <li>
              <b>1</b>
              <span>
                Click <strong>Start Call</strong> and allow microphone access.
              </span>
            </li>
            <li>
              <b>2</b>
              <span>Ask about a sample order, return, or product.</span>
            </li>
            <li>
              <b>3</b>
              <span>Watch the conversation and tool execution.</span>
            </li>
          </ol>
        </section>
        <section className="guide-section">
          <h3>Things to try</h3>
          <p>Say these aloud during a call. Click to copy.</p>
          <div className="guide-questions">
            {questions.map((q, i) => (
              <button
                key={q}
                title="Copy question to say aloud"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(q);
                    setCopied(i);
                  } catch {
                    setCopied(null);
                  }
                }}
              >
                <span>“{q}”</span>
                {copied === i ? (
                  <Check size={13} aria-label="Copied" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            ))}
          </div>
        </section>
        <section className="guide-section">
          <h3>Sample orders</h3>
          <p>Fictional orders you can ask the agent about.</p>
          <div className="guide-orders">
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
        </section>
        <section className="guide-section">
          <h3>Products</h3>
          <p>Expand a product for real demo sizes, colors, and availability.</p>
          <div className="guide-products">
            {products.map((p) => {
              const available = p.variants.filter((v) => v.quantity > 0),
                unavailable = p.variants.filter((v) => v.quantity === 0);
              return (
                <details key={p.product_name}>
                  <summary>
                    {p.product_name}
                    <ChevronDown size={13} />
                  </summary>
                  <div className="guide-variants">
                    <p>
                      <strong>In stock</strong>
                      {available.map((v) => (
                        <span key={`${v.size}-${v.color}`}>
                          {v.size} · {v.color}{" "}
                          <small>({v.quantity} available)</small>
                        </span>
                      ))}
                    </p>
                    {unavailable.length > 0 && (
                      <p>
                        <strong>Out of stock</strong>
                        {unavailable.map((v) => (
                          <span key={`${v.size}-${v.color}`}>
                            {v.size} · {v.color}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
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
