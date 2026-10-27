"use client";
import { useState } from "react";
import { Copy, Check, BookOpen, ChevronDown } from "lucide-react";
export type OrderReference = {
  order_number: string;
  status: string;
  product: string;
};
const questions = {
  Orders: [
    "Where is order 123?",
    "Can you check order 456?",
    "What happened to order 567?",
  ],
  Returns: ["Can I return order 123?", "Is order 345 eligible for a return?"],
  Gear: [
    "Do you have snowboard boots in size 10?",
    "Is the camping tent available?",
  ],
  Troubleshooting: ["Can you check order 999?"],
};
export function DemoGuide({ orders }: { orders: OrderReference[] }) {
  const [category, setCategory] = useState<keyof typeof questions>("Orders"),
    [copied, setCopied] = useState("");
  return (
    <section className="demo-guide" aria-label="Self-guided demo">
      <div className="guide-top">
        <div className="guide-intro">
          <strong>Try asking</strong>
          <span>Start a call, then say a question aloud. Click to copy.</span>
        </div>
        <div className="guide-categories" aria-label="Question categories">
          {(Object.keys(questions) as (keyof typeof questions)[]).map(
            (name) => (
              <button
                key={name}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ),
          )}
        </div>
        <details className="order-reference">
          <summary>
            <BookOpen size={13} />
            Sample orders
            <ChevronDown size={12} />
          </summary>
          <div className="reference-popover">
            <strong>Fictional order reference</strong>
            <p>Use these three-digit numbers in your call.</p>
            {orders.map((o) => (
              <div className="reference-order" key={o.order_number}>
                <code>{o.order_number}</code>
                <span>{o.product}</span>
                <small className={`order-status ${o.status}`}>{o.status}</small>
              </div>
            ))}
            <div className="reference-order missing">
              <code>999</code>
              <span>Intentionally not found</span>
            </div>
            <small>
              Returns and delivery dates use the fixed demo date, October 27,
              2026.
            </small>
          </div>
        </details>
      </div>
      <div className="question-chips">
        {questions[category].map((q) => (
          <button
            key={q}
            title="Copy question to say aloud"
            onClick={async () => {
              await navigator.clipboard.writeText(q);
              setCopied(q);
              setTimeout(() => setCopied(""), 2000);
            }}
          >
            <span>“{q}”</span>
            {copied === q ? <Check size={12} /> : <Copy size={12} />}
          </button>
        ))}
        <span className="copy-feedback" role="status">
          {copied
            ? "Copied — say it aloud during your call."
            : category === "Troubleshooting"
              ? "A missing order is an expected business error."
              : ""}
        </span>
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
