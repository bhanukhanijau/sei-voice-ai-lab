"use client";
import { useEffect, useRef, useState, useReducer } from "react";
import type Vapi from "@vapi-ai/web";
import {
  AudioLines,
  Box,
  Bug,
  ChevronRight,
  Headphones,
  Mic,
  PhoneOff,
  Play,
  Sun,
} from "lucide-react";
import { Button } from "./ui/button";
import type { Mode } from "@/lib/catalog";
import Image from "next/image";
import { Conversation } from "./conversation";
import {
  DemoGuide,
  microphoneMessage,
  type OrderReference,
  type ProductReference,
} from "./demo-guide";
import { ExecutionTimeline } from "./execution-timeline";
import {
  emptyTimeline,
  normalizeEvent,
  errorText,
  type RawEvent,
} from "@/lib/timeline";
import { orderAssistantPrompt } from "@/lib/assistant-prompt";
type Tool = {
  name: string;
  description: string;
  schema: unknown;
  example: unknown;
};
type Config = {
  publicKey: string;
  assistantId: string;
  baseUrl: string;
  tools: Tool[];
  modes: Mode[];
  modeDescriptions: Record<Mode, string>;
  configs: unknown[];
};
async function fetchConfig(signal?: AbortSignal): Promise<Config> {
  const response = await fetch("/api/config", { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Cannot load lab");
  return data;
}
function Json({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="json">
      <Button
        className="copy"
        onClick={async () => {
          await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
function PromptInstructions() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel">
      <h2>Give the assistant instructions for all three tools</h2>
      <p>
        In Vapi, open your SEI assistant and check that lookup_order,
        check_return_eligibility, and check_inventory are selected in its Tools
        tab. A tool saved in the library must also be attached to the assistant.
      </p>
      <p>
        Save a copy of the current system prompt, then use this starter prompt
        in the Vapi system prompt field. Save/publish, end any existing call,
        and start a new call.
      </p>
      <label>
        SEI starter system prompt
        <textarea rows={14} readOnly value={orderAssistantPrompt} />
      </label>
      <Button
        onClick={async () => {
          await navigator.clipboard.writeText(orderAssistantPrompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy system prompt"}
      </Button>
      <p>
        Try “Check order 123.” In Vapi Calls → Messages, verify a lookup_order
        invocation with order_number 123 appears before the spoken answer. A
        prompt cannot enable a tool that is not attached.
      </p>
    </section>
  );
}

export default function Lab({
  orderReference,
  productReference,
}: {
  orderReference: OrderReference[];
  productReference: ProductReference[];
}) {
  const [boot, setBoot] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState("Playground"),
    [busy, setBusy] = useState(false);
  const [tool, setTool] = useState("lookup_order"),
    [mode, setMode] = useState<Mode>("normal"),
    [args, setArgs] = useState('{"order_number":"123"}'),
    [test, setTest] = useState<unknown>(null);
  const [state, setState] = useState("Disconnected"),
    [speaking, setSpeaking] = useState(false),
    [volume, setVolume] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [callId, setCallId] = useState(""),
    [messages, setMessages] = useState<{ role: string; text: string }[]>([]),
    [timeline, dispatchTimeline] = useReducer(
      (state: ReturnType<typeof emptyTimeline>, event: RawEvent | null) =>
        event ? normalizeEvent(state, event) : emptyTimeline(),
      undefined,
      emptyTimeline,
    );
  const sdk = useRef<Vapi | null>(null),
    started = useRef(0);
  async function act(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchConfig(controller.signal)
      .then(setBoot)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Cannot load lab");
      });
    return () => controller.abort();
  }, []);
  useEffect(
    () => () => {
      sdk.current?.stop();
    },
    [],
  );
  useEffect(() => {
    if (state !== "Connected") return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started.current) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [state]);
  async function start() {
    if (!boot) return;
    setState("Connecting");
    setMessages([]);
    dispatchTimeline(null);
    const record = (event: string, payload: unknown = {}) =>
      dispatchTimeline({ event, payload, receivedAt: Date.now() });
    setCallId("");
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const { default: VapiClient } = await import("@vapi-ai/web");
      const v = new VapiClient(boot.publicKey);
      sdk.current = v;
      v.on("call-start", () => {
        record("call-start");
        setState("Connected");
        started.current = Date.now();
      });
      v.on("call-end", () => {
        record("call-end");
        setState("Disconnected");
        setSpeaking(false);
        setVolume(0);
      });
      v.on("speech-start", () => setSpeaking(true));
      v.on("speech-end", () => setSpeaking(false));
      v.on("volume-level", setVolume);
      v.on("error", (e) => {
        record(
          "error",
          e instanceof Error
            ? { message: e.message, name: e.name, stack: e.stack }
            : e,
        );
        setError(errorText(e));
        setState("Disconnected");
      });
      v.on("message", (m) => {
        record("message", m);
        if (m.type === "transcript" && m.transcriptType === "final")
          setMessages((prev) => [
            ...prev,
            { role: m.role, text: m.transcript },
          ]);
      });
      // The SDK's generated type incorrectly declares a scalar; the Vapi API accepts an array.
      // Only event subscriptions are overridden. Native tools and model settings stay in Vapi.
      const subscriptions = [
        "conversation-update",
        "function-call",
        "function-call-result",
        "hang",
        "model-output",
        "speech-update",
        "status-update",
        "transfer-update",
        "transcript",
        "tool-calls",
        "tool-calls-result",
        "user-interrupted",
        "voice-input",
        "workflow.node.started",
        "assistant.started",
      ];
      const call = await v.start(boot.assistantId, {
        clientMessages: subscriptions as unknown as NonNullable<
          Parameters<Vapi["start"]>[1]
        >["clientMessages"],
      });
      if (call?.id) {
        setCallId(call.id);
      }
    } catch (e) {
      record(
        "error",
        e instanceof Error
          ? { message: e.message, name: e.name, stack: e.stack }
          : e,
      );
      sdk.current?.stop();
      setState("Disconnected");
      throw e;
    }
  }
  const endpoint = boot ? `${boot.baseUrl}/api/tools/webhook?mode=${mode}` : "";
  const selected = boot?.tools.find((t) => t.name === tool);
  if (!boot)
    return (
      <main className="loading">
        <div className="loading-card">
          <h1>
            {error ? "Unable to load the lab" : "Loading SEI Voice AI Lab…"}
          </h1>
          {error && (
            <>
              <p role="alert" className="error">
                {error}
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(async () => setBoot(await fetchConfig()))
                }
              >
                Try again
              </Button>
            </>
          )}
        </div>
      </main>
    );
  return (
    <div className={`app ${page === "Playground" ? "playground-app" : ""}`}>
      <aside>
        <div className="brand">
          <Image
            src="/brand/sei-mark.svg"
            alt="SEI mountain logo"
            width={36}
            height={36}
          />
          <strong>
            SEI <span>SUPER EQUIPMENT INC.</span>
          </strong>
        </div>
        <p className="nav-label">READY FOR OUTSIDE.</p>
        <nav>
          {[
            ["Playground", Headphones],
            ["Tools & Debugger", Bug],
            ["Vapi Setup", Box],
          ].map(([name, Icon]) => {
            const NavIcon = Icon as typeof Headphones;
            return (
              <button
                key={String(name)}
                className={page === name ? "active" : ""}
                onClick={() => {
                  setPage(String(name));
                  setError("");
                }}
              >
                <NavIcon size={17} />
                {String(name)}
              </button>
            );
          })}
        </nav>
        <div className="aside-footer">
          Fictional SEI data<p>No database · No saved sessions</p>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            SEI Lab <ChevronRight size={13} />
            <b>{page}</b>
          </span>
          <div>
            <Button
              onClick={() => document.documentElement.classList.toggle("light")}
              aria-label="Toggle color theme"
            >
              <Sun size={15} />
            </Button>
            <a
              className="btn outline"
              href="https://dashboard.vapi.ai"
              target="_blank"
              rel="noreferrer"
            >
              Open Vapi ↗
            </a>
          </div>
        </header>
        <main>
          {page === "Playground" ? (
            <div className="playground-intro">
              <div>
                <div className="eyebrow">READY FOR OUTSIDE. HERE TO HELP.</div>
                <h1>Meet your SEI AI Support Agent</h1>
                <p>
                  Experience a voice-powered customer support agent that can
                  check orders, answer return questions, and look up outdoor
                  gear availability.
                </p>
              </div>
              <span className="fictional-label">INTERACTIVE VOICE DEMO</span>
            </div>
          ) : (
            <div className="heading">
              <div>
                <div className="eyebrow">LEARN BY TROUBLESHOOTING</div>
                <h1>{page}</h1>
                <p>
                  Use Vapi for configuration and logs. Use this lab to talk and
                  test.
                </p>
              </div>
            </div>
          )}
          {error && page !== "Playground" && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {page === "Playground" && (
            <>
              <section
                className={`call-bar ${error ? "has-error" : ""}`}
                aria-label="Voice call controls"
              >
                <div
                  className={`agent-avatar ${state === "Connected" ? "connected" : ""}`}
                >
                  <AudioLines size={23} />
                </div>
                <div className="agent-name">
                  <strong>SEI Support Agent</strong>
                  <span>
                    <i
                      className={`connection-dot ${state === "Connected" ? "connected" : ""}`}
                    />
                    {state === "Connected"
                      ? speaking
                        ? "Assistant speaking"
                        : "Listening to you"
                      : state === "Connecting"
                        ? "Connecting…"
                        : "Ready to talk"}
                    <span className="connection-state"> · {state}</span>
                  </span>
                </div>
                <div className="call-meter">
                  <meter
                    min={0}
                    max={1}
                    value={volume}
                    aria-label="Assistant audio level"
                  />
                  <span>Live audio</span>
                </div>
                <span className="call-duration mono" aria-label="Call duration">
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                  {String(elapsed % 60).padStart(2, "0")}
                </span>
                <div className="call-actions">
                  <Button
                    variant="default"
                    disabled={
                      busy || state !== "Disconnected" || !boot.publicKey
                    }
                    onClick={() => void act(start)}
                  >
                    <Mic size={15} />
                    Start call
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={state === "Disconnected"}
                    onClick={() => {
                      sdk.current?.stop();
                      setState("Disconnected");
                    }}
                  >
                    <PhoneOff size={15} />
                    End call
                  </Button>
                </div>
                <div className="call-hint">
                  <span>Microphone required · Uses Vapi credits</span>
                  {callId && (
                    <span className="mono" title={callId}>
                      Call: {callId}
                    </span>
                  )}
                </div>
                {error && (
                  <div className="call-permission-error" role="alert">
                    {microphoneMessage(error)}
                  </div>
                )}
              </section>
              <DemoGuide
                orders={orderReference}
                products={productReference}
                active={state !== "Disconnected"}
              />
              <div className="playground-workspace">
                <Conversation messages={messages} />
                <ExecutionTimeline timeline={timeline} callId={callId} />
              </div>
              <p className="public-demo-disclaimer">
                Demo environment using fictional customer and order data. Voice
                calls powered by Vapi.
              </p>
            </>
          )}
          {page === "Tools & Debugger" && (
            <>
              <section className="panel">
                <h2>Choose a mock function and failure mode</h2>
                <div className="grid">
                  <label>
                    Function
                    <select
                      value={tool}
                      onChange={(e) => {
                        setTool(e.target.value);
                        setArgs(
                          JSON.stringify(
                            boot.tools.find((t) => t.name === e.target.value)
                              ?.example || {},
                            null,
                            2,
                          ),
                        );
                        setTest(null);
                      }}
                    >
                      {boot.tools.map((t) => (
                        <option key={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    URL mode
                    <select
                      value={mode}
                      onChange={(e) => {
                        setMode(e.target.value as Mode);
                        setTest(null);
                      }}
                    >
                      {boot.modes.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p>{selected?.description}</p>
                <div className="alert">{boot.modeDescriptions[mode]}</div>
                <p>
                  Set this Server URL on the native Vapi tool. This selector
                  only prepares a URL and a local test; it does not update Vapi.
                </p>
                <Json value={{ serverUrl: endpoint }} />
                <details>
                  <summary>Function parameters and example</summary>
                  <Json
                    value={{
                      schema: selected?.schema,
                      example: selected?.example,
                    }}
                  />
                </details>
              </section>
              <section className="panel">
                <h2>Test request / response</h2>
                <p>
                  This executes the same adapter as the public webhook and
                  displays its actual response. It does not call the voice
                  assistant. Nothing is saved.
                </p>
                <label>
                  Arguments
                  <textarea
                    rows={5}
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    spellCheck={false}
                  />
                </label>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      setTest(null);
                      const payload = {
                        message: {
                          type: "tool-calls",
                          toolCallList: [
                            {
                              id: crypto.randomUUID(),
                              type: "function",
                              function: {
                                name: tool,
                                arguments: JSON.parse(args),
                              },
                            },
                          ],
                        },
                      };
                      const start = performance.now();
                      const response = await fetch("/api/test?mode=" + mode, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                      });
                      const raw = await response.text();
                      let body: unknown = raw;
                      try {
                        body = JSON.parse(raw);
                      } catch {}
                      setTest({
                        request: payload,
                        httpStatus: response.status,
                        elapsedMs: Math.round(performance.now() - start),
                        response: body,
                      });
                    })
                  }
                >
                  <Play size={14} />
                  {busy ? "Executing…" : "Test function"}
                </Button>
                {test !== null && <Json value={test} />}
              </section>
              <section className="panel">
                <h2>Available endpoint modes</h2>
                {boot.modes.map((m) => (
                  <p key={m}>
                    <code>/api/tools/webhook?mode={m}</code>
                    <br />
                    {boot.modeDescriptions[m]}
                  </p>
                ))}
                <p>
                  All webhook modes work without authentication. One mode
                  applies to the whole HTTP request, including batched tool
                  calls.
                </p>
              </section>
            </>
          )}
          {page === "Vapi Setup" && (
            <>
              <PromptInstructions />
              <section className="panel">
                <h2>Update lookup_order and add the two tools</h2>
                <ol>
                  <li>
                    In Vapi Dashboard, open Tools → Create Tool → Function.
                  </li>
                  <li>
                    For the existing lookup_order, update its parameters to
                    require order_number as a string. Create
                    check_return_eligibility and check_inventory using the exact
                    configurations below.
                  </li>
                  <li>
                    Set Server URL to{" "}
                    <code>{boot.baseUrl}/api/tools/webhook?mode=normal</code>.
                  </li>
                  <li>
                    Leave Authentication set to None. These are public,
                    read-only fictional tools.
                  </li>
                  <li>
                    Keep synchronous execution and a 20-second timeout.
                    Save/publish the tool.
                  </li>
                  <li>
                    Open your existing assistant, add the two new tools
                    alongside lookup_order in Tools, preserve existing settings,
                    then save/publish.
                  </li>
                  <li>
                    Start a call and ask to track 123. Compare the spoken status
                    with the webhook result in Vapi Calls.
                  </li>
                </ol>
                <p>
                  The backend also accepts the previous orderNumber argument,
                  but the new prompt uses order_number. Update the existing
                  native schema before testing the new prompt. All values are
                  strings.
                </p>
                {boot.configs.slice(0, 3).map((config, index) => (
                  <details key={boot.tools[index].name}>
                    <summary>
                      {boot.tools[index].name} — exact native Function
                      configuration
                    </summary>
                    <Json value={config} />
                  </details>
                ))}
                <p>
                  No token or credential is needed on this mock tool endpoint.
                </p>
                <p>
                  Assistant: <code>{boot.assistantId}</code>
                </p>
              </section>
              <section className="panel">
                <h2>Try these phrases</h2>
                <ul>
                  <li>“Can you check the status of order 123?”</li>
                  <li>“Is order 123 eligible for a return?”</li>
                  <li>“Do you have snowboard boots in size ten, black?”</li>
                  <li>“Check order 999.” (missing record)</li>
                </ul>
                <p>
                  Only attached tools can be called. Save/publish all three
                  assignments and paste the updated system prompt into Vapi
                  manually.
                </p>
                <h2>Troubleshooting exercises</h2>
                <ol>
                  <li>
                    Ask “Where is my order?” and check whether the assistant
                    asks for an order number.
                  </li>
                  <li>
                    Change the tool URL to mode=error, repeat the order request
                    and inspect the valid tool error.
                  </li>
                  <li>
                    Try mode=http500, then mode=malformed. Compare HTTP failure
                    with a bad envelope.
                  </li>
                  <li>
                    Try mode=slow. Set the Vapi tool timeout to 5 seconds to
                    practice a timeout, then restore 20 seconds.
                  </li>
                  <li>Restore mode=normal and repeat the same question.</li>
                </ol>
                <p>
                  Open Vapi Dashboard → Calls (under Logs) → your call. Messages
                  shows tool arguments/results. Logs → Webhooks shows HTTP
                  requests/responses. Use Latency Summary for pipeline timing.
                  This app does not infer a root cause from missing evidence.
                </p>
                <a
                  className="btn outline"
                  href="https://dashboard.vapi.ai/calls"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open native Vapi call logs ↗
                </a>
              </section>
            </>
          )}
          <footer>
            SEI Voice AI Lab{" "}
            <span>Simple mock tools. Real Vapi conversations.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
