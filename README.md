# SEI Voice AI Lab

Live: [sei-voice-ai-lab.vercel.app](https://sei-voice-ai-lab.vercel.app) · [Existing private GitHub repository](https://github.com/bhanukhanijau/sei-voice-ai-lab)

A small interview sandbox with working Vapi browser voice, hardcoded SEI data, a request/response tester, and URL-based failures. No passwords, databases, saved sessions, or configuration syncing. Vapi owns native tools and assistant settings. The original SEI application is untouched. Existing membership support is retained; this expansion focuses on the three tools below.

## Local use and deployment

Requires Node 22+ and pnpm 11+.

```sh
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
pnpm dev
```

On this machine, `./scripts/dev-local.sh` finds the bundled Node runtime. Open http://localhost:3000 directly; no login is required.

| Environment variable          | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| NEXT_PUBLIC_VAPI_PUBLIC_KEY   | Existing public Web SDK key                                                 |
| NEXT_PUBLIC_VAPI_ASSISTANT_ID | Existing assistant ID                                                       |
| APP_BASE_URL                  | https://sei-voice-ai-lab.vercel.app in production; localhost in development |

The existing private GitHub repository is connected to the existing Vercel project. Commit and push to main to deploy; verify the production URL after the build. Do not create a new repository/service. No private Vapi API key is required. Environment files are ignored by Git and excluded from Vercel uploads. Old authentication/database variables are unused.

## Deterministic fictional data

Dates are frozen at **October 27, 2026**. This keeps repeated interview tests consistent instead of silently aging the return window. The fixtures return their sandbox reference date. The return policy is **30 days after delivery**, inclusive of the deadline, for unused gear in original condition.

| Order (string) | Product         | Status     | Key date / detail                                                           | Return eligibility            |
| -------------- | --------------- | ---------- | --------------------------------------------------------------------------- | ----------------------------- |
| 123            | Snowboard boots | Delivered  | Purchased Oct 14; delivered Oct 20                                          | Eligible through Nov 19, 2026 |
| 234            | Hiking backpack | Processing | Purchased Oct 26; payment accepted; estimated Oct 31                        | Not yet shipped               |
| 345            | Camping tent    | Shipped    | Purchased Oct 21; FedEx mock tracking; estimated Oct 29                     | In transit                    |
| 456            | Ski jacket      | Delayed    | Purchased Oct 19; UPS mock tracking; estimate revised from Oct 25 to Nov 2  | Not delivered                 |
| 567            | Snowboard       | Cancelled  | Purchased Oct 22; cancelled Oct 23; USD 429 refund pending, expected Oct 30 | Cancelled                     |
| 999            | No record       | Not found  | Deliberate missing-record test                                              | Order not found               |

All order IDs and tool arguments are strings. Input `123`, `1 2 3`, `one two three`, and `one hundred twenty three` normalize to `"123"`. Arbitrary surrounding text, ambiguous choices and numeric JSON values are rejected with a request to repeat the three digits separately. The backend never blindly strips digits.

For compatibility, the old `orderNumber` argument remains accepted. Only the four historical IDs are exact aliases: SEI-1001→123, SEI-1002→234, SEI-1003→345, SEI-1004→456. They are implementation compatibility cases, not voice examples; results expose only the canonical three-digit string. New native schemas and the prompt use `order_number`. The existing tool's response envelope is unchanged. Its business result now uses the documented snake_case fields below.

Inventory: snowboard boots offer Black sizes 9/10, Gray size 10, with Black 11 unavailable; backpacks have 30 L Green and 45 L Black stock; tents have three units total across two variants; ski jackets have some unavailable sizes/colors; snowboards have limited 152/156 cm stock and no 160 cm stock. General checks aggregate matching variants; requested variants return their actual matching quantity, available variants, and alternatives when unavailable. Unknown products return a tool error; unoffered variants return zero stock with a clarification reason. Optional size/color values are strings. A missing record uses normal mode with order `"999"`; it is separate from injected business failures.

## Manual Vapi dashboard checklist

1. In Vapi → Tools, edit the existing **lookup_order** Function. Replace its parameters with `order_number` (string) as shown below, and update its description. Keep its existing tool ID and server path. The backend accepts the prior argument during migration, but the new prompt and schema must agree.
2. Create **check_return_eligibility** and **check_inventory** as Function tools using their exact definitions below. Do not merely save them in the Tools library.
3. In Assistants, select existing assistant `f1adb106-6546-469a-a808-5df31fb1573f`. Add both new tools alongside lookup_order in its Tools tab. Save/publish as prompted.
4. Save a copy of the current system prompt, then paste the complete prompt below into Vapi manually. The app does not create tools, attach them, or overwrite prompts through APIs or SDK overrides.
5. End any existing call and start a new call on the hosted app. Ask “Check order one two three,” “Can I return order one two three?” and “Are snowboard boots size ten in black available?”
6. Inspect Vapi Calls → Messages for the selected function, arguments and result. Test the failure modes below, restore normal, and repeat.

Exact complete proposals are also in [vapi-tools.json](vapi-tools.json), generated from the implementation, and the hosted app's **Vapi Setup** tab. These files do not synchronize with Vapi.

### lookup_order

Function tool. Authentication: **None**. Synchronous, timeout **20 seconds**.

Description: Look up a fictional SEI order using its three-digit order_number string. Ask the caller to say each digit separately if missing or unclear; never guess.

Parameter schema to paste into Vapi:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "order_number": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "Three-digit order number as a string, for example 123. Ask for separate digits if unclear."
    }
  },
  "required": ["order_number"],
  "additionalProperties": false
}
```

Server URL: https://sei-voice-ai-lab.vercel.app/api/tools/webhook?mode=normal

Request-start: “Let me check that for you.” Request-failed: “I could not retrieve that information. Please try again.”

### check_return_eligibility

Function tool. Authentication: **None**. Synchronous, timeout **20 seconds**.

Description: Check the 30-day return eligibility for a fictional SEI order using its three-digit order_number string. Use this tool for return questions; it does not create a return.

Parameter schema to paste into Vapi:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "order_number": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "Three-digit order number as a string, for example 123. Ask for separate digits if unclear."
    }
  },
  "required": ["order_number"],
  "additionalProperties": false
}
```

Server URL: https://sei-voice-ai-lab.vercel.app/api/tools/webhook?mode=normal

Request-start: “Let me check that for you.” Request-failed: “I could not retrieve that information. Please try again.”

### check_inventory

Function tool. Authentication: **None**. Synchronous, timeout **20 seconds**.

Description: Check fictional stock for a product_name, optionally narrowed by size and color. Ask which product is wanted; clarify variants before promising a particular size or color.

Parameter schema to paste into Vapi:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "product_name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "Product name, such as snowboard boots, hiking backpack, camping tent, ski jacket, or snowboard."
    },
    "size": {
      "description": "Requested size, such as 10, M, or 156 cm, if supplied.",
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "color": {
      "description": "Requested color, if supplied.",
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "required": ["product_name"],
  "additionalProperties": false
}
```

Server URL: https://sei-voice-ai-lab.vercel.app/api/tools/webhook?mode=normal

Request-start: “Let me check that for you.” Request-failed: “I could not retrieve that information. Please try again.”

## Complete system prompt to paste into Vapi

```text
You are Alex, a friendly voice support assistant for SEI, a fictional outdoor retailer. Help with order status, return eligibility, and product availability. Speak naturally in one or two short sentences, ask one question at a time, and do not read JSON aloud.

ORDER NUMBERS
Ask for the three-digit order number and prefer separate digits: "Please say the three digits one at a time." All order numbers passed to tools must be strings. If clearly spoken, normalize "one two three", "one hundred twenty three", or "1 2 3" to "123". If missing, uncertain, conflicting, or invalid, ask the caller to repeat the three digits separately. Never guess, extract an order number from unrelated numbers, or speak internal legacy aliases.

TOOL ROUTING
- For order status, collect the order number and call lookup_order with {"order_number":"123"}, substituting the caller's actual number. Wait for the result, then explain the returned status, delivery date/estimate, tracking, or refund details that answer the question.
- For return questions, collect the order number and call check_return_eligibility with {"order_number":"123"}. Explain eligible, reason, return_deadline when present, and next_step. This tool checks eligibility only; do not claim to have initiated a return or refund.
- For inventory questions, collect product_name and call check_inventory, for example {"product_name":"Snowboard boots","size":"10","color":"Black"}. Include size and color only if the caller supplies them. If asking generally, the product name alone is sufficient; describe available variants. Before promising stock for a particular variant, ask for any missing size/color needed and check that variant. Use quantity_available and in_stock from the result. Offer only alternatives actually returned by the tool.

ACCURACY AND FAILURES
Use only tools attached to this assistant. Never invent an order status, date, tracking number, refund, quantity, size, color, or stock claim. Never claim to have accessed a system unless an actual usable tool result was received. Do not substitute memorized sample answers for a fresh tool call.
If a tool reports order not found, explain that and ask the caller to verify the three digits. If the input is invalid or ambiguous, ask for the three digits separately. For an unknown product or variant, clarify the product/size/color or offer actual returned alternatives.
If a tool errors, times out, returns malformed data, or provides no usable result, say you could not complete the check and offer to retry. Do not turn a failure into a successful answer. Avoid directing callers to a website when a relevant tool is available. If a required tool is not attached, explain the limitation honestly.

The tools use fictional data frozen around October 27, 2026. Treat returned sandbox dates as fictional test dates and do not invent updates based on the current real-world date.
```

The app's Vapi Setup tab provides the same prompt with a copy button. It does not apply it automatically. Only tools actually attached to the assistant can be invoked.

## Results and debugging

lookup_order returns `order_number`, `status`, `product`, `order_date`, `shipping_status`, and applicable carrier/tracking/delivery/cancellation/refund fields, plus return eligibility and the fixed reference date. No tracking is invented for orders that have not shipped. check_return_eligibility returns `order_number`, boolean `eligible`, `reason`, applicable `return_deadline`, `next_step` and the reference policy. It does not initiate a return. check_inventory returns `product_name`, requested size/color when supplied, `in_stock`, `quantity_available` and actual available variants/alternatives.

Every Function uses the same public endpoint; the function name in the webhook selects its business logic. All modes remain password-free and affect mock tools only:

| Mode query      | Actual behavior                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------ |
| ?mode=normal    | Structured mock result or valid missing-record/input error                                       |
| ?mode=error     | HTTP 200 with a correlated tool error string                                                     |
| ?mode=slow      | Wait 8 seconds, then return the normal result; set Vapi timeout to 5 seconds to practice timeout |
| ?mode=malformed | HTTP 200 with a deliberately invalid response envelope                                           |
| ?mode=http500   | Real HTTP 500                                                                                    |

Restore the 20-second timeout and normal URL after testing. No state is persisted. One HTTP response carries all results in a batch; transport-level faults affect that whole request.

The adapter accepts Vapi's `message.type: tool-calls` and `message.toolCallList`. Object and JSON-string function arguments are accepted. Results preserve exact IDs and serialize business data as flat strings:

```json
{
  "results": [
    {
      "toolCallId": "incoming-id",
      "result": "{\"order_number\":\"123\",\"status\":\"delivered\"}"
    }
  ]
}
```

On business/input failures, return HTTP 200 with `error` instead of `result` for that ID. Invalid webhook JSON/envelopes return HTTP 400. Every valid incoming tool call receives its own result or error. There is no hidden model reasoning or fabricated provider telemetry.

In Vapi → Calls → your call, **Messages** shows actual tool arguments/results; **Logs → Webhooks** shows HTTP requests/responses/errors; **Transcript** shows spoken behavior; **Latency Summary** shows provider pipeline timing. The lab's debugger shows real direct backend requests/responses and elapsed time, not a simulated provider call.

## Verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
# With the dev server running:
pnpm test:http
# Test the actual production endpoint after deployment:
TEST_BASE_URL=https://sei-voice-ai-lab.vercel.app pnpm test:http
```

Tests cover normalization and rejected ambiguities, compatibility, five consistent order states, return rules, inventory variants, missing records, input validation, exact batched toolCallId correlation, and failure modes. HTTP smoke tests never initiate paid calls. Genuine voice use of the two new native tools requires the manual Vapi checklist above. The existing order voice flow was confirmed by the user before this expansion; new spoken results are not assumed from backend tests.

Official references checked October 27, 2026: [Function tools and protocol](https://docs.vapi.ai/tools/custom-tools), [prompting guide](https://docs.vapi.ai/prompting-guide), [native call logs](https://docs.vapi.ai/observability/logs/call-logs).

### Playground execution timeline

The event panel normalizes observed Web SDK messages into grouped speech, connection, interruption, error, and tool entries. Partials are temporary live indicators; model/audio chatter stays in the optional **Raw Events** view. Every timeline entry has collapsed **Technical details**. Raw messages are retained in tab memory for the current call, can be copied, and reset on a new call. Nothing is persisted.

Calls now request the default client message subscriptions plus `function-call-result` and `tool-calls-result` using a per-call `clientMessages` override. This changes telemetry delivery only; the existing assistant, model, native Function tools, webhook URLs, and system prompt are preserved. The installed SDK's generated declaration incorrectly types this API array as a scalar, so this subscription field has a localized type assertion.

Tool calls correlate by ID with forwarded `toolCallResult` messages or actual tool results in `conversation-update` history. Missing or uncorrelated results never establish success/failure. Execution duration and HTTP status appear only when explicitly supplied by telemetry; receipt timing is not labeled server duration. Business errors such as an unknown order differ from explicit HTTP errors; other causes remain unidentified unless telemetry identifies them. A completed return-eligibility check with `eligible: false` is still a successful check.

The backend currently writes per-request metadata to Vercel logs, without storing response traces. These logs cannot be retrieved by the browser. No private Vapi API key is configured, so this app does not fetch authenticated call records or expose credentials. Use the timeline's **Vapi call logs** link when HTTP/protocol details or backend results are absent from SDK telemetry. See [Vapi client-message configuration](https://docs.vapi.ai/api-reference/assistants/create) and [Web SDK](https://github.com/VapiAI/client-sdk-web).

### Compact SEI Outdoors Playground

The Playground uses a 160px sidebar for navigation, theme switching and the real Vapi dashboard link; there is no horizontal top navigation bar. The compact branded introduction and call controls sit above a viewport-sized workspace. At widths of 1280px and above, permanent guide/conversation/execution columns use approximately 27/32/41 percent of the available width. Each panel scrolls independently, with its header outside the scroll area. The guide has no dependency on call state and never automatically collapses. Expanding products or technical JSON changes only the relevant panel's scroll content.

Between 781px and 1279px, conversation and execution remain side by side with an independently scrolling guide drawer that overlays rather than resizes the workspace. On mobile, conversation comes first, followed by execution and the guide; section links provide quick access, and voice controls remain sticky. Mobile page scrolling is allowed. “Latest” resumes smart following after inspecting earlier transcript/events. Suggestions only copy questions for visitors to say aloud. All sample orders, products and stock variants come from the existing server-side mock fixtures.

Brand assets were copied from the existing SEI retail demo without modifying that project: `public/brand/sei-mark.svg` reuses its mountain mark; `public/brand/outdoors.jpg` reuses its alpine image. The forest `#183c32`, sage `#c4d0a8`, and Arial/Helvetica typography follow that project. Original photo credit: Zihao Wang, [Unsplash](https://unsplash.com/photos/a-majestic-mountain-peak-overlooks-a-serene-alpine-lake-Flkv4kpZT6A), Unsplash License, as recorded in the source project's asset manifest.

### Public reviewer presentation

The entire app opens in the warm light theme; the sidebar utility toggle still offers dark mode. The Playground guide gives three explicit steps, four supported sample questions, visible order references, and expandable product variants with real mock quantities and unavailable stock. The guide remains mounted before, during and after calls. No Vapi settings or transcript/event processing were changed by the navigation refactor.

Visual checks cover 1440×900, 1280×800, 1920×1080 and 390px mobile, plus the intermediate guide drawer. A temporary local fixture was used to stress long transcripts, long strings, large tool details, raw-event switching and simulated lifecycle updates. Panel geometry and manual scroll inspection remained stable; “Latest” resumed following new content. The fixture was removed before the production build and is not part of the application or deployment. These are layout tests, not fabricated live Vapi evidence or a paid voice-call verification.

Sharing review: the browser only receives the public Vapi SDK key, assistant ID, and fictional demo data. There is no private Vapi API key or persistent assistant/tool configuration mutation endpoint. The public debugger executes read-only fictional lookups; failure mode selection affects that request only. The app has no application-level call quota, so unauthenticated public visitors can consume the owner's Vapi credits. Provider/account-level spending, concurrency, and domain restrictions have not been verified or changed by this frontend update. No authentication, backend, tool, environment, or Vapi assistant changes were made.

### Public-source release review

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the Git-history secret scan, original-project provenance comparison, endpoint review, safe hardening changes and remaining billing/access-control considerations. `.env.example` intentionally contains no account-specific values; fill in your own public SDK key and assistant ID in an ignored `.env.local`. The live demo continues to use its existing environment settings. Repository visibility is not changed by these fixes.

### Live conversation reconciliation

`src/lib/conversation.ts` keeps stable user/assistant turn identities from Vapi `turn` and `turnId` where supplied, plus conservative arrival-order grouping where they are absent. Partial transcripts update the current utterance in place; finalized fragments reconcile with confirmed text. Shorter delayed partials cannot erase observed prefixes. Explicit distinct turns remain separate even when their wording is identical. Empty metadata records never render as chat bubbles or count as dialogue. “Preparing response”, “Speaking” and “Listening” are transient status indicators outside message history.

Model output is never displayed as speech. The old fallback (`transcript || caption || generated`) could reveal a complete generated response, then replace it with a shorter live transcript. Text-only `assistant.speechStarted` captions may also include a complete turn before all words play, so they now drive only the Speaking status. An explicit provider `word-progress.wordsSpoken` cursor can reveal its reported prefix, without timer interpolation. Other timing formats are retained in Raw Events rather than guessed. If a provider supplies no partial transcript or supported progress cursor, the UI waits for actual final transcript evidence rather than simulating streaming.

`user-interrupted` stops provisional updates for that turn and preserves observed transcript/provider-progress text with a muted Interrupted marker. A supplied LLM ID is matched exactly and bound to an unbound active turn where possible; late events cannot interrupt a newer known turn. A late final transcript can correct the interrupted bubble. Conversation history is still used for technical tool evidence, not replayed into dialogue. Raw Events and collapsed technical details retain all original payloads, including generated text. Without explicit turn identity, late untagged finals remain inherently ambiguous; the UI cannot establish exact audible words from generated text or unaligned captions.

Representative fixtures grounded in the installed SDK types cover generated-before-speech, incremental/repeated partials, final reconciliation, overlapping fragments, interruptions and rapid following turns, tool success/error sequences, and valid order 567. Browser fixtures are synthetic, not live voice evidence. A real browser call was attempted locally but remained Connecting without any SDK call-start/transcript events, so audio behavior could not be verified. Remaining manual check: start a new call, ask “Can you tell me about order 567?”, interrupt the assistant midway with an inventory question, and inspect the bubbles, interruption marker and actual tool events; confirm provider cadence locally and on the production demo. No word-level audio synchronization is claimed.

For the optional order-number prompt correction, see [the exact manual patch](docs/vapi-order-prompt-patch.md). The app does not overwrite saved Vapi prompts, tools, credentials or configuration.
