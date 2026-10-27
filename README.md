# SEI Voice AI Lab

Live: [sei-voice-ai-lab.vercel.app](https://sei-voice-ai-lab.vercel.app) · [Private GitHub repository](https://github.com/bhanukhanijau/sei-voice-ai-lab)

A small Vapi interview sandbox: the existing voice playground, four hardcoded mock functions, a request/response tester, and URL-based failures. No database, saved sessions, management API, or tool synchronization. Use Vapi's dashboard for assistant settings, tool creation and call logs. The original SEI application is untouched.

## Local use

Requires Node 22+ and pnpm 11+.

```sh
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
pnpm dev
```

On this machine `./scripts/dev-local.sh` also finds the bundled Node runtime. Open http://localhost:3000. Use ADMIN_PASSWORD from the ignored `.env.local` file. Existing public key, assistant ID and voice SDK integration are preserved. The shared password is kept only in page memory and sent through HTTP Basic authentication to the lab API. Reloading locks the page. Use HTTPS when hosted.

| Variable                      | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| NEXT_PUBLIC_VAPI_PUBLIC_KEY   | Existing Vapi public Web SDK key                             |
| NEXT_PUBLIC_VAPI_ASSISTANT_ID | Existing assistant ID                                        |
| ADMIN_PASSWORD                | One private lab password; protects SDK settings and debugger |
| APP_BASE_URL                  | Actual production origin; localhost for development          |

No private Vapi API key is required. Old DATABASE_URL, SESSION_SECRET and VAPI_PRIVATE_API_KEY variables are unused; they need not be deployed. Local environment files are preserved, ignored by Git, and excluded from Vercel uploads. Do not paste secrets into chat or commit them.

## GitHub → Vercel

Authenticate privately in your browser when the CLIs request it:

```sh
gh auth login --hostname github.com --git-protocol https --web
vercel login
```

Create a new private repository for this existing directory, commit and push only reviewed source:

```sh
git add .
git commit -m "Simplify SEI Vapi interview sandbox"
gh repo create sei-voice-ai-lab --private --source=. --remote=origin --push
```

Import that private repository in Vercel → Add New → Project, with Next.js defaults. Add the environment variables above through Vercel's private environment settings. Deploy, set APP_BASE_URL to the actual production URL, then redeploy. Connecting the repository may require you to approve Vercel's GitHub access. Do not change repository visibility to work around an authorization issue. `vercel.json` supplies the build/install commands; the webhook has a 30-second maximum duration. No database or extra service is needed.

After deployment verify the actual public page and `/api/health`. Ensure Vercel deployment protection does not block the production Function webhook: a Vapi request must reach the public mock endpoint rather than a Vercel login page. Keep preview protection as desired. Never claim a deployment succeeded until its URL responds correctly.

## First Function: lookup_order

In [Vapi Dashboard](https://dashboard.vapi.ai):

1. Tools → Create Tool → **Function**.
2. Function name: `lookup_order`.
3. Description: `Look up a fictional SEI order by order number. Ask for the order number first; never guess it.`
4. Parameters:

```json
{
  "type": "object",
  "properties": {
    "orderNumber": { "type": "string", "minLength": 1, "maxLength": 100 }
  },
  "required": ["orderNumber"],
  "additionalProperties": false
}
```

5. Server URL: `https://sei-voice-ai-lab.vercel.app/api/tools/webhook?mode=normal`. The app's **Tools & Debugger** and **Vapi Setup** tabs generate the full URL and exact JSON configuration. Localhost is not reachable by Vapi.
6. Leave **Authentication: None**. This read-only fictional webhook is intentionally public, as requested; no token or custom credential is needed.
7. Keep synchronous execution and a 20-second timeout. Optional request-start message: “Let me check that for you.” Request-failed: “I could not retrieve that information. Please try again.”
8. Open existing assistant `f1adb106-6546-469a-a808-5df31fb1573f` → Tools → add lookup_order. Confirm lookup_order appears in the assistant’s assigned tools; creating it in the Tools library alone is not enough. Save/publish as prompted.
9. Make a voice call: “Hi, can you help me check the status of my order?” Supply SEI-1001 when asked. Expected backend result: shipped, estimated delivery 2026-10-29, fictional tracking MOCK-TRACK-1001. Confirm the assistant speaks the actual result.

### Give the assistant instructions

The app calls the saved assistant by ID without prompt overrides. A generic default prompt can produce “I cannot access external systems” instead of a tool lookup. First confirm the tool is attached to this exact assistant, then save a copy of the current system prompt and use this starter in Vapi:

```text
You are Alex, the voice support assistant for SEI, a fictional outdoor retailer. Be friendly and concise. Ask one question at a time.

For order status requests:
1. If the order number is missing, ask for it. Never invent an order number.
2. Once you have the order number, call the attached lookup_order tool with the orderNumber argument before answering about status.
3. For example, "Check order SEI-1001" requires lookup_order with {"orderNumber":"SEI-1001"}. Normalize a clearly spoken SEI order number to that format; ask for clarification if uncertain.
4. Wait for the actual tool result. Explain the returned status, estimated delivery and tracking information only when provided. Do not read raw JSON aloud.
5. If the tool returns an error, cannot be called, or provides no usable result, explain that the lookup could not be completed and offer to retry. Never make up an order status or delivery date.

Use lookup_order instead of giving generic instructions to check a company portal. You can access the fictional SEI order data through this tool when it is attached. Do not claim to have checked an order unless you actually called the tool and received its result. Keep spoken answers to one or two short sentences.
```

Save/publish the assistant, end any existing call and start a new call. The hosted app’s **Vapi Setup** tab also provides this text with a copy button. This prompt is a manual setup proposal; it is not applied to Vapi automatically.

If the agent still refuses, inspect the actual call in Vapi → Messages. No lookup_order invocation points you toward assignment, active assistant version, tool description/schema, model compatibility or prompt instructions. A tool invocation with a failed result points you toward its arguments, Server URL and webhook response. The transcript alone does not distinguish these causes.

The app never registers or attaches tools automatically. Configure the other tools similarly after the first one works:

| Function                 | Required argument | Example phrase                           |
| ------------------------ | ----------------- | ---------------------------------------- |
| lookup_order             | orderNumber       | “Track order SEI-1001.”                  |
| check_return_eligibility | orderNumber       | “Can I return order SEI-1002?”           |
| check_inventory          | productId         | “Is product P-04 in stock?”              |
| get_membership_details   | customerId        | “What benefits does customer C-01 have?” |

## Failures and protocol

Change the native tool's Server URL query to select behavior. No toggles are synchronized, and no state is saved.

| Path                              | Real behavior                                   |
| --------------------------------- | ----------------------------------------------- |
| /api/tools/webhook?mode=normal    | Normal mock business result                     |
| /api/tools/webhook?mode=error     | HTTP 200 with a valid correlated `error` string |
| /api/tools/webhook?mode=slow      | Wait 8 seconds, then return normally            |
| /api/tools/webhook?mode=malformed | HTTP 200 with an intentionally wrong envelope   |
| /api/tools/webhook?mode=http500   | Genuine HTTP 500                                |

All modes are available without authentication and affect only read-only fictional tools. To observe a provider timeout, use slow mode with a Vapi tool timeout of 5 seconds; afterward restore 20 seconds and mode=normal. A URL mode applies to all calls in one webhook request. Separate calls cannot change each other's behavior.

The Function endpoint accepts Vapi's `message.type: tool-calls` and `message.toolCallList`. Both object and JSON-string arguments are supported. Every call preserves its exact ID:

```json
{
  "results": [
    { "toolCallId": "the-incoming-id", "result": "{\"status\":\"shipped\"}" }
  ]
}
```

Business/input failures return HTTP 200 with `error` instead of `result`. Invalid webhook JSON/envelopes return HTTP 400. Batched requests get one correlated result/error per input call. Intentional malformed and HTTP-failure modes deliberately break the usual contract. The debugger displays the actual request, HTTP status, elapsed time and body from the shared adapter. Server logs contain only basic IDs, mode, status and duration; no separate logging database exists.

## Where to troubleshoot

Vapi Dashboard → **Calls** under Logs → select your call:

- **Messages**: actual tool selection, arguments and results.
- **Logs → Webhooks**: HTTP URL, authentication outcome, response status/body and timeout evidence.
- **Transcript**: what the caller and assistant actually said.
- **Latency Summary**: provider pipeline timing; compare it with the backend's own elapsed duration.

Exercises: omit the order number and check for clarification; request SEI-9999 and inspect a business error; compare error vs http500 vs malformed; use slow to reproduce a timeout; restore normal and repeat the same phrase. Do not blame the prompt for a malformed response envelope. Do not infer the cause of latency without checking each relevant boundary.

Current official references: [Function protocol](https://docs.vapi.ai/tools/custom-tools), [call logs](https://docs.vapi.ai/observability/logs/call-logs).

## Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
# With the dev server running:
pnpm test:http
```

HTTP smoke tests never initiate a paid Vapi call. Genuine audio, tool invocation and spoken use of the result require a manual browser call after the native tool is attached. The public site and public no-auth webhook modes were verified on Vercel on 2026-10-27. Nine tests, lint, type checks, production build and GitHub CI passed. A genuine hosted voice/tool conversation remains to be verified after you manually attach lookup_order in Vapi.
