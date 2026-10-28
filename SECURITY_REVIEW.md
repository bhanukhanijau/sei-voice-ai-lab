# Public-release security review

Reviewed October 27, 2026. Repository: [bhanukhanijau/sei-voice-ai-lab](https://github.com/bhanukhanijau/sei-voice-ai-lab). Pre-review baseline: `5633ce8`. Visibility remains **private**.

## Recommendation

**GO for publishing the reviewed source code after these fixes are merged.** No exposed private credential or confidential original-project content was found in the inspected repository/history. No mandatory secret rotation or history rewrite is indicated by the findings below. This is a scoped review, not a guarantee against all vulnerabilities or an independent determination of asset ownership.

The live demo has a separate, material **billing/abuse risk**: anyone with its public Vapi key can attempt calls, and the app has no application-level call quota. Verify provider-side allowed origins, allowed assistants, transient-assistant settings, concurrency and spending controls before wider distribution. This review did not change Vapi configuration, environment variables, repository visibility, or account limits.

## Scope and evidence

- Fetched every advertised remote branch and tag. The repository is not shallow. The nine pre-review commits on `origin/main` were inspected, including deleted/modified files (78 unique historical blobs). GitHub reported no pull requests or release assets.
- Also inspected all 118 local Git blobs, including dangling objects and local checkpoint refs, to catch material outside published branch history. These local-only objects are not normally published by changing GitHub visibility.
- Ran checksum-verified Gitleaks 8.30.1 on all Git refs and separately on every decodable local blob. Reports were redacted and kept outside the repository. Manually searched for provider token formats, private-key blocks, credential-bearing URLs, JWTs, credential assignments, sensitive filenames, non-demo email addresses and local absolute paths.
- Compared actual credential values from the ignored local lab and original SEI environment files against Git blobs **in memory only**, without printing them or sending them to any service. No matches were found. No candidate credential was tested against a provider.
- Reviewed API handlers, SDK setup, input validation, raw-event rendering, workflow permissions, dependency lockfile, ignore rules, mock records and asset provenance. Audited both production and development dependencies using `pnpm audit`: **zero reported advisories** across 543 dependencies at review time.
- GitHub's secret-scanning alerts API reports scanning disabled for this private repository; do not interpret that as a clean GitHub scan. The existing default workflow token permission is read-only. Branch-protection settings could not be retrieved on the current private-repository plan.

## Credentials, history and rotation

| Finding                                                                             | Assessment                                                                                                                                                          | Action                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real public Vapi SDK key and assistant ID in historical `.env.example`              | Client-side identifiers, not a private REST API key. Already exposed by the working public demo's `/api/config`.                                                    | Replaced current example values with blanks so clones configure their own account. Deployed/local runtime values were preserved. Restrict the key in Vapi; removing it from one file does not protect a browser key. |
| Gitleaks generic-key alerts                                                         | The single history finding and four all-object findings all point to `NEXT_PUBLIC_VAPI_ASSISTANT_ID`, the same public assistant identifier.                         | Manually classified as false positives; no scanner allowlist was added to conceal future findings.                                                                                                                   |
| Early `ADMIN_PASSWORD` and `VAPI_WEBHOOK_SECRET` values                             | Instruction-style `choose-…` placeholders, not matching actual local credentials. The corresponding auth paths were subsequently removed.                           | No active secret to rotate based on these values. If someone reused a literal example as a real credential elsewhere, replace it there.                                                                              |
| Private Vapi/OpenAI/GitHub/Vercel credentials, private keys, real environment files | None found in the reviewed Git history or objects. The original project's actual credentials did not match repository objects.                                      | No required rotations identified. Real `.env.local` and Vercel CLI files remain ignored.                                                                                                                             |
| Commit/contact metadata                                                             | Published author email is a GitHub noreply address; customer email addresses use `example.invalid`. No personal local filesystem paths found in scanned text blobs. | No removal required.                                                                                                                                                                                                 |

Vapi explicitly documents that browser/public keys are visible and should be restricted. An allowed-assistant restriction does **not** prevent per-call assistant overrides; do not use public-key restrictions as protection for confidential prompts or server credentials. See [Vapi API key security](https://docs.vapi.ai/security-and-privacy/api-keys). No confidential prompts or server credentials were found here. Account restrictions could not be verified because the available dashboard session is signed out and no private Vapi key is configured.

## Endpoint and application review

| Public surface                         | Behavior and risk                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/config`                      | Returns only the public SDK key, assistant ID, public base URL, fictional tool schemas/examples and failure-mode definitions. No private environment values or credential store is returned.                                                                                                   |
| `GET /api/health`                      | Returns a static status/storage summary.                                                                                                                                                                                                                                                       |
| `POST /api/tools/webhook`              | Intentionally unauthenticated, read-only fictional tool execution. Names are allowlisted; arguments and batched IDs are validated. No database writes, payments, arbitrary command execution, dynamic evaluation or outbound server fetch is performed.                                        |
| `POST /api/test`                       | Uses the same read-only adapter. It cannot modify the Vapi assistant, native tools, server environment, or a shared persistent failure mode.                                                                                                                                                   |
| `?mode=slow/error/malformed/http500`   | Request-local exercise modes. The slow mode can hold an invocation for eight seconds, so high request volume can incur Vercel costs even without voice calls. No distributed rate limit is present.                                                                                            |
| Unknown API paths, unsupported methods | No administrative configuration or filesystem endpoints were found. Unknown API paths return 404; unsupported Next.js route methods return 405.                                                                                                                                                |
| Browser transcript/timeline            | React renders data as text; no raw HTML insertion or `eval` was found. Call-log links encode the call ID. Raw events stay in the current tab and are copied only by user action; they are not persisted by this app. Vapi's own call retention is separate and outside this repository review. |

Security headers already include `nosniff`, same-origin referrer policy and frame denial. The request-body limit previously checked size only **after** buffering the entire body. It now checks declared length and counts streamed bytes, cancelling requests over 100,000 bytes with HTTP 413 before JSON parsing/tool execution. Normal Function request/response formats and failure modes are preserved. HTTP request metadata is logged without headers, credentials, full arguments, business responses or transcripts.

No unrestricted administrative mutation endpoint was found. The public debugger is intentionally available and executes synthetic data only; it is not an administrative control plane. Public hosting remains abuse-prone without provider/edge rate or spend controls. Those controls were not changed because this task preserves the working Vapi demo and its public access.

## Original SEI project and third-party content

Compared 173 original-project files, including source, documentation, reports, session/data artifacts and assets, against every published historical blob using exact hashes and 40-token text overlap. Also checked all local text blobs against 11 supplemental original knowledge documents; no 40-token matches were found. No copied confidential original application code, internal reports, real customer/session exports, knowledge files, private credentials or source maps were found. Similarity checks cannot prove independent authorship or ownership.

The exact matching files are:

- `public/brand/sei-mark.svg`: intentional copy of the fictional SEI mountain mark from the original demo, as requested for branding.
- `public/brand/outdoors.jpg`: intentional copy of the alpine photograph. The original project's asset manifest attributes it to **Zihao Wang**, under the **Unsplash License**; the credit/source link is retained in the README. [Photo source](https://unsplash.com/photos/a-majestic-mountain-peak-overlooks-a-serene-alpine-lake-Flkv4kpZT6A).
- `next-env.d.ts`: identical generated Next.js boilerplate.

Orders, products, inventory and memberships are hardcoded fictional fixtures. Payment/refund fields are mock values; no actual payment integration exists. The original project was not modified. No new open-source license was selected automatically: choosing a license for code you own is a separate release decision.

## Safe fixes included

1. Sanitized `.env.example` without changing live Vapi environment values.
2. Added ignore/deployment-exclusion rules for local private keys, credential files and machine-specific files.
3. Made CI permissions explicitly `contents: read`, disabled persisted checkout credentials, and pinned the existing official checkout/setup-node actions to their verified full commit SHAs.
4. Enforced the existing payload-size intent during request streaming, with tests for oversized, multibyte, declared-length and chunked payloads.
5. Documented source provenance, intentional public endpoints, billing exposure, scan scope and remaining verification limits.

## Validation and release follow-up

Validation: all 24 tests (including the new body-size tests), TypeScript, ESLint and the production build passed. The current tracked tree and resulting commit are re-scanned before pushing; the live HTTP smoke suite is run after deployment. Historical public-identifier false positives are reviewed rather than blanket-excluding `.env` files.

Before broad demo distribution, verify Vapi key/account restrictions. After making the repository public yourself, enable GitHub secret scanning/push protection and branch protection where available. Keep real environment files and diagnostic exports out of commits. No visibility change, credential rotation, force-push/history rewrite, new hosting service, or paid voice call is part of this review.

## Source navigation

- [Main Vapi browser integration](https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/src/components/lab.tsx)
- [Business functions and mock orders/products/customers](https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/src/lib/business.ts)
- [Tool schemas and native Function configurations](https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/src/lib/catalog.ts)
- [Webhook HTTP handler](https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/src/app/api/%5B...path%5D/route.ts)
- [Tool-call execution and response adapter](https://github.com/bhanukhanijau/sei-voice-ai-lab/blob/main/src/lib/engine.ts)
