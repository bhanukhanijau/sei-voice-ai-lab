"use client";
import { useEffect, useRef, useState } from "react";
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
const questionGroups = [
  {
    category: "Order tracking",
    questions: ["What's the status of order 123?"],
  },
  { category: "Returns", questions: ["Can I return order 123?"] },
  {
    category: "Inventory",
    questions: ["Do you have snowboard boots in size 10?"],
  },
  {
    category: "Knowledge Search (RAG)",
    questions: [
      "How should my snowboard boots fit?",
      "How do I set up my snowboard?",
    ],
  },
  { category: "Troubleshooting", questions: ["Can you find order 999?"] },
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
  const [copied, setCopied] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({
    above: false,
    below: false,
    thumbTop: 0,
    thumbSize: 100,
  });
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      above: el.scrollTop > 4,
      below: el.scrollHeight - el.clientHeight - el.scrollTop > 4,
      thumbTop: el.scrollHeight ? (el.scrollTop / el.scrollHeight) * 100 : 0,
      thumbSize: el.scrollHeight
        ? Math.min(100, (el.clientHeight / el.scrollHeight) * 100)
        : 100,
    });
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  const questionButton = (q: string) => (
    <button
      key={q}
      title="Copy question to say aloud"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(q);
          setCopied(q);
        } catch {
          setCopied(null);
        }
      }}
    >
      <span>“{q}”</span>
      {copied === q ? (
        <Check size={13} aria-label="Copied" />
      ) : (
        <Copy size={13} />
      )}
    </button>
  );
  const bootOrder = orders.find((o) => o.order_number === "123");
  return (
    <section className="panel guide-panel" id={id}>
      <div className="panel-head">
        <div className="panel-label">
          <BookOpen size={15} />
          <h2>Demo guide & sample data</h2>
        </div>
      </div>
      <div
        className={`guide-scroll-shell ${edges.above ? "has-above" : ""} ${edges.below ? "has-below" : ""}`}
      >
        <div
          ref={scroller}
          onScroll={measure}
          className="guide-scroll"
          tabIndex={0}
          aria-label="Demo guide and sample data"
        >
          <div className="guide-content">
            <section className="guide-section guide-quick-start">
              <h3>Quick start</h3>
              <p>
                Click <strong>Start Call</strong>, ask about a sample order or
                product, and watch the agent use its tools in real time.
              </p>
            </section>
            <section className="guide-section">
              <h3>Sample Orders</h3>
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
            <section className="guide-section things-to-try">
              <h3>Things to Try</h3>
              <p>
                Speak these questions aloud during a call. Click a question to
                copy it.
              </p>
              {questionGroups.map(({ category, questions }) => (
                <div
                  key={category}
                  className={`guide-question-group ${category === "Knowledge Search (RAG)" ? "knowledge-example" : ""}`}
                >
                  <h4>{category}</h4>
                  <div className="guide-questions">
                    {questions.map(questionButton)}
                  </div>
                </div>
              ))}
            </section>
            <section className="guide-section product-guides">
              <h3>Product Guides · Knowledge Search (RAG)</h3>
              <p>
                The agent can search SEI&apos;s snowboard setup guide to answer
                questions about boot fitting, bindings, and preparing for a
                first ride.
              </p>
              {bootOrder && (
                <div className="guide-scenario">
                  <strong>From delivery to first ride</strong>
                  <p>
                    Ask about order {bootOrder.order_number} (
                    {bootOrder.product} · {bootOrder.status}), then ask how to
                    fit your new boots.
                  </p>
                </div>
              )}
              <p className="guide-retrieval-note">
                Uses Vapi&apos;s native <code>search_sei_guides</code> tool. The
                timeline shows searches only when Vapi exposes the events; call
                logs remain available for details.
              </p>
              <a
                className="guide-article-link"
                href="https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/docs/snowboardGuide.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the source article ↗
              </a>
            </section>
            <section className="guide-section">
              <h3>Inventory Products</h3>
              <p>
                Expand a product for real demo sizes, colors, and availability.
              </p>
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
        </div>
        {(edges.above || edges.below) && (
          <div className="guide-scroll-rail" aria-hidden="true">
            <span
              style={{
                top: `${edges.thumbTop}%`,
                height: `${edges.thumbSize}%`,
              }}
            />
          </div>
        )}
        {edges.below && (
          <div className="guide-scroll-hint" aria-hidden="true">
            Scroll for more <ChevronDown size={13} />
          </div>
        )}
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
