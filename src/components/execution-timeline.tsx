"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  AudioLines,
  Wrench,
  Check,
  CircleAlert,
  Plug,
  Hand,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  businessFields,
  relativeTime,
  shouldFollow,
  type TimelineState,
} from "@/lib/timeline";

export function ExecutionTimeline({
  timeline,
  callId,
}: {
  timeline: TimelineState;
  callId: string;
}) {
  const [rawView, setRawView] = useState(false),
    [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null),
    follow = useRef(true);
  useEffect(() => {
    if (follow.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [timeline, rawView]);
  return (
    <section className="panel execution-panel" id="execution">
      <div className="panel-head">
        <h2>Execution timeline</h2>
        <div className="timeline-controls">
          <div
            className="timeline-view-toggle"
            role="group"
            aria-label="Event view"
          >
            <button
              type="button"
              aria-pressed={!rawView}
              onClick={() => setRawView(false)}
            >
              Timeline
            </button>
            <button
              type="button"
              aria-pressed={rawView}
              onClick={() => setRawView(true)}
            >
              Raw Events ({timeline.raw.length})
            </button>
          </div>
          {rawView && (
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify(timeline.raw, null, 2),
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>
      <p className="timeline-note">
        Observed Vapi events only. Tool results appear when Vapi forwards them
        or includes them in conversation history. Missing telemetry does not
        establish success or failure.
      </p>
      <div
        className="execution-scroll"
        ref={scroller}
        tabIndex={0}
        aria-label={rawView ? "Raw call events" : "Call execution timeline"}
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = shouldFollow(
            el.scrollTop,
            el.clientHeight,
            el.scrollHeight,
          );
        }}
      >
        {rawView ? (
          <pre className="raw-call-events">
            {JSON.stringify(timeline.raw, null, 2)}
          </pre>
        ) : (
          <>
            {!timeline.entries.length && (
              <div className="timeline-empty">
                <Plug size={22} />
                <p>
                  Start a call to follow the conversation and tool activity
                  here.
                </p>
              </div>
            )}
            <ol className="execution-list">
              {timeline.entries.map((e) => {
                const Icon =
                  e.kind === "tool"
                    ? Wrench
                    : e.kind === "user"
                      ? Mic
                      : e.kind === "assistant"
                        ? AudioLines
                        : e.kind === "error"
                          ? CircleAlert
                          : e.kind === "interruption"
                            ? Hand
                            : Plug;
                const knowledgeSearch =
                  e.kind === "tool" && e.title === "search_sei_guides";
                const status =
                  e.status === "success"
                    ? "Success"
                    : e.status === "error"
                      ? e.category === "Business error"
                        ? "Completed · Business error"
                        : "Failed"
                      : e.status === "pending"
                        ? "Awaiting result"
                        : e.kind === "tool"
                          ? "Result not available"
                          : "";
                return (
                  <li
                    key={e.id}
                    className={`execution-entry ${e.kind} ${e.status || ""} ${e.category === "Business error" ? "business-error" : ""}`}
                  >
                    <div className="execution-icon">
                      <Icon size={16} />
                    </div>
                    <div className="execution-content">
                      <div className="execution-title">
                        <strong>
                          {knowledgeSearch
                            ? "Knowledge Search (RAG)"
                            : e.kind === "tool"
                              ? `Tool: ${e.title}`
                              : e.title}
                        </strong>
                        <time>{relativeTime(e.at, timeline.startedAt)}</time>
                      </div>
                      {knowledgeSearch && (
                        <code className="execution-tool-name">{e.title}</code>
                      )}
                      {status && (
                        <span
                          className={`execution-status ${e.status || ""} ${e.category === "Business error" ? "business-error" : ""}`}
                        >
                          {e.status === "success" ? (
                            <Check size={12} />
                          ) : e.status === "error" ? (
                            <CircleAlert size={12} />
                          ) : null}
                          {status}
                          {e.httpStatus !== undefined
                            ? ` · HTTP ${e.httpStatus}`
                            : ""}
                          {e.durationMs !== undefined
                            ? ` · ${(e.durationMs / 1000).toFixed(2)}s execution`
                            : ""}
                        </span>
                      )}
                      {e.text &&
                        e.kind !== "assistant" &&
                        e.kind !== "user" && (
                          <p className="execution-speech">“{e.text}”</p>
                        )}
                      {e.args !== undefined && (
                        <div className="argument-summary">
                          <span>Arguments</span>{" "}
                          {businessFields(e.args).length ? (
                            businessFields(e.args).map(([k, v]) => (
                              <code key={k}>
                                {k} = {JSON.stringify(v)}
                              </code>
                            ))
                          ) : (
                            <code>{JSON.stringify(e.args)}</code>
                          )}
                        </div>
                      )}
                      {e.error && (
                        <div className="execution-error" role="status">
                          <strong>{e.category}</strong>
                          <p>{e.error}</p>
                        </div>
                      )}
                      {e.result !== undefined &&
                        (businessFields(e.result).length ? (
                          <dl className="business-result">
                            {businessFields(e.result).map(([k, v]) => (
                              <div key={k}>
                                <dt>{k}</dt>
                                <dd>{v}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="execution-speech">
                            {typeof e.result === "string"
                              ? e.result
                              : "Result received. Expand technical details to inspect its structure."}
                          </p>
                        ))}
                      {e.kind === "tool" &&
                        (e.status === "pending" || e.status === "unknown") && (
                          <p className="timeline-note">
                            No usable result observed yet. Check Vapi call logs
                            for backend HTTP or protocol details.
                          </p>
                        )}
                      <details className="event-details">
                        <summary>Technical details</summary>
                        <pre>
                          {JSON.stringify(
                            {
                              transcript: e.text,
                              arguments: e.args,
                              response: e.result,
                              evidence: e.raw.map((i) => timeline.raw[i]),
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
            {timeline.live && (
              <div className="timeline-live" role="status">
                <span className="dot" />
                {timeline.live.startsWith("Assistant:")
                  ? "Assistant responding…"
                  : timeline.live.startsWith("User:")
                    ? "User speaking…"
                    : timeline.live}
              </div>
            )}
          </>
        )}
      </div>
      <div className="timeline-footer">
        <span>
          Times relative to connection · Raw payloads kept for this call in this
          tab
        </span>
        <a
          href={
            callId
              ? `https://dashboard.vapi.ai/calls/${encodeURIComponent(callId)}`
              : "https://dashboard.vapi.ai/calls"
          }
          target="_blank"
          rel="noreferrer"
        >
          Vapi call logs ↗
        </a>
        <Button
          onClick={() => {
            follow.current = true;
            if (scroller.current)
              scroller.current.scrollTop = scroller.current.scrollHeight;
          }}
        >
          <ChevronDown size={12} />
          Latest
        </Button>
      </div>
    </section>
  );
}
