"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
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
  { category: "Orders", question: "What's the status of order 123?" },
  { category: "Returns", question: "Can I return order 123?" },
  {
    category: "Inventory",
    question: "Do you have snowboard boots in size 10?",
  },
  {
    category: "Guides",
    question: "How should my snowboard boots fit?",
  },
  { category: "Guides", question: "How do I set up my snowboard?" },
  { category: "Errors", question: "Can you find order 999?" },
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
              <h3>Quick Start</h3>
              <p>
                Click <strong>Start Call</strong>, ask one of the questions
                below, and watch the conversation and tool activity.
              </p>
            </section>
            <section className="guide-section try-asking">
              <h3>Try Asking</h3>
              <p>Start a call, then try asking these questions aloud.</p>
              <ul className="suggested-questions">
                {questions.map(({ category, question }) => (
                  <li className="suggested-question" key={question}>
                    <span className="question-badge">{category}</span>
                    <span className="suggested-question-text">
                      “{question}”
                    </span>
                  </li>
                ))}
              </ul>
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
