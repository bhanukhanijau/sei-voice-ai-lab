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
const questions = [
  { category: "Order Tracking", question: "What's the status of order 123?" },
  { category: "Returns", question: "Can I return order 123?" },
  {
    category: "Inventory",
    question: "Do you have snowboard boots in size 10?",
  },
  {
    category: "Snowboard Help",
    question: "How should my snowboard boots fit?",
  },
  { category: "Setup Help", question: "How do I set up my snowboard?" },
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
  const questionButton = ({
    category,
    question: q,
  }: (typeof questions)[number]) => (
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
      <span>
        <small className="question-capability">{category}</small>
        <span className="question-text">“{q}”</span>
      </span>
      {copied === q ? (
        <Check size={13} aria-label="Copied" />
      ) : (
        <Copy size={13} />
      )}
    </button>
  );
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
                Click <strong>Start Call</strong>, then say one of the questions
                below. Watch the conversation and tool activity update in real
                time.
              </p>
            </section>
            <section className="guide-section things-to-try">
              <h3>Things to Try</h3>
              <p>Say these aloud during a call. Click to copy.</p>
              <div className="guide-questions primary-questions">
                {questions.map(questionButton)}
              </div>
            </section>
            <section className="guide-section">
              <h3>Sample Orders</h3>
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
            <section className="guide-section product-guides">
              <h3>Snowboard Setup Guide</h3>
              <p>
                Ask about snowboard boot fit, bindings, or getting ready for
                your first ride.
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
