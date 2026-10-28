"use client";
import { useEffect, useRef } from "react";
import { AudioLines, ArrowDown, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { shouldFollow } from "@/lib/timeline";
export type ConversationMessage = { role: string; text: string };
export function Conversation({
  messages,
}: {
  messages: ConversationMessage[];
}) {
  const scroller = useRef<HTMLDivElement>(null),
    follow = useRef(true);
  useEffect(() => {
    if (follow.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);
  return (
    <section className="panel conversation-panel" id="conversation">
      <div className="panel-head">
        <div className="panel-label">
          <MessageSquare size={16} />
          <h2>Conversation</h2>
        </div>
        <span className="badge">{messages.length} messages</span>
      </div>
      <div
        ref={scroller}
        className="conversation-scroll"
        tabIndex={0}
        aria-label="Conversation transcript"
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = shouldFollow(
            el.scrollTop,
            el.clientHeight,
            el.scrollHeight,
          );
        }}
      >
        {messages.length ? (
          messages.map((m, i) => (
            <div className={`conversation-message ${m.role}`} key={i}>
              <span className="speaker-mark">
                {m.role === "user" ? "Y" : "S"}
              </span>
              <div>
                <small>
                  {m.role === "user"
                    ? "YOU"
                    : m.role === "assistant"
                      ? "SEI SUPPORT"
                      : m.role.toUpperCase()}
                </small>
                <p>{m.text}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="conversation-empty">
            <div className="empty-audio">
              <AudioLines size={27} />
            </div>
            <h3>Your next adventure starts here.</h3>
            <p>
              Start a call and ask about an order, a return, or your next piece
              of gear.
            </p>
            <span>Speak naturally. Your conversation appears here.</span>
          </div>
        )}
      </div>
      <div className="conversation-footer">
        <span>Finalized speech · Live during your call</span>
        <Button
          onClick={() => {
            follow.current = true;
            if (scroller.current)
              scroller.current.scrollTop = scroller.current.scrollHeight;
          }}
        >
          <ArrowDown size={12} />
          Latest
        </Button>
      </div>
    </section>
  );
}
