# Project Status

Last updated: 2026-03-04

## Deployed — MCP Server Expansion v0.4.0 (2026-03-04)

Expanded `@pincerpay/mcp` from 7 scaffolding-only tools to 20 tools covering the full developer lifecycle: setup, configure, deploy, monitor, debug.

### Phase 1: Monitoring (3 tools)
- [x] `check-facilitator-health` — wraps GET /health
- [x] `get-settlement-metrics` — wraps GET /v1/metrics
- [x] `verify-payment` — wraps POST /v1/verify

### Phase 2: Facilitator CRUD + MCP Tools (5 tools, 2 prompts)
- [x] Facilitator routes: paywall CRUD (GET/POST/PUT/DELETE /v1/paywalls), transaction listing (GET /v1/transactions)
- [x] MCP tools: `list-paywalls`, `create-paywall`, `update-paywall`, `delete-paywall`, `list-transactions`
- [x] MCP prompts: `manage-paywalls`, `monitor-payments`
- [x] Zod schemas: pagination, paywall CRUD, transaction filters

### Phase 3: Agents + Webhooks + Merchant (5 tools)
- [x] Facilitator routes: agents (GET/PUT /v1/agents), webhooks (GET /v1/webhooks, POST /v1/webhooks/:id/retry), merchant (GET /v1/merchant)
- [x] MCP tools: `list-agents`, `update-agent`, `list-webhooks`, `retry-webhook`, `get-merchant-profile`

### Cross-cutting
- [x] FacilitatorClient: `requestWithMethod()` for PUT/DELETE, 12 new API methods
- [x] Route constants in @pincerpay/core
- [x] Rate limits: 30/min for write operations on CRUD routes
- [x] All docs updated (README, llms.txt, MCP docs page, API reference, CHANGELOG)
- [x] `pnpm typecheck` — 16/16 passed
- [x] `pnpm test` — 14/14 passed (142 tests)
- [x] `pnpm build` — 11/11 passed

### TODO: npm Publish
- [ ] `npm publish` for @pincerpay/mcp v0.4.0

## Deployed — MCP Server Docs + Claude Code Enablement (2026-03-04)

MCP server integration is now fully documented and one-command-ready for Claude Code users.

- [x] New doc page: [pincerpay.com/docs/mcp-server](https://pincerpay.com/docs/mcp-server)
- [x] Quick Start for Claude Code, Claude Desktop, Cursor, Windsurf, Remote HTTP
- [x] Tools/Resources/Prompts reference tables
- [x] "Try It" section with example prompts
- [x] Updated `llms.txt` (root + public) with MCP Server entry in SDKs section
- [x] Updated `llms-full.txt` with full MCP Server content
- [x] Deployed to Vercel (`pnpm deploy:dashboard`)

**Claude Code one-liner:** `claude mcp add pincerpay -- npx -y @pincerpay/mcp`

## Published — npm Packages v0.1.1 (2026-03-04)

All 5 @pincerpay packages republished to npm as v0.1.1 with SEO and discoverability improvements:
- [x] `@pincerpay/core@0.1.1` — badges, expanded keywords (16), types/chain-config/constants
- [x] `@pincerpay/solana@0.1.1` — badges, expanded keywords (17), spl-token/transfer-checked/devnet/mainnet
- [x] `@pincerpay/merchant@0.1.1` — badges, expanded keywords (18), paywall/api-monetization/machine-to-machine
- [x] `@pincerpay/agent@0.1.1` — badges, expanded keywords (18), fetch-wrapper/autonomous/spending-policy/agentic
- [x] `@pincerpay/mcp@0.1.1` — badges, expanded keywords (19), mcpName, claude/cursor/copilot/ai-tools

### npm SEO + LLM Discoverability (#87, #88)
- [x] Added 4 badges to all 5 READMEs (npm version, downloads, license, TypeScript)
- [x] Expanded keywords to 16-19 per package for npm search indexing
- [x] Added `@pincerpay/solana` to llms.txt (was missing)
- [x] Created `smithery.yaml` for MCP directory auto-registration
- [x] Added `mcpName: "pincerpay-mcp"` to MCP package.json
- [x] Added `syncFacilitatorOnStart` option to `PincerPayConfig` (fixes build-time facilitator error in Next.js examples)
- [x] All 5 packages republished as v0.1.1
- [x] Closes #87, #88

### MCP Server Expansion — Done
- [x] Plan mode completed, 3-phase plan executed
- [x] 13 new tools (7 → 20), 2 new prompts (4 → 6)
- [x] New facilitator CRUD routes: paywalls, transactions, agents, webhooks, merchant
- [x] See "Deployed — MCP Server Expansion v0.4.0" above

### MCP Directory Submissions (Manual — Pending)
- [ ] Submit to Smithery (https://smithery.ai/new — reads smithery.yaml)
- [ ] Submit to mcp.so
- [ ] PR to awesome-mcp-servers
- [ ] Glama (auto-indexes from npm — should appear after keyword update)
- [ ] Submit to cursor.directory

## Deployed — Docs Screenshots (2026-03-03)

### Playwright Screenshot Pipeline
- [x] Screenshots script generates 26 images: 12 tour steps, 5 component isolations, 9 doc section crops
- [x] `deviceScaleFactor: 2` for Retina-quality output (2x pixel density)
- [x] 6 curated screenshots published to `apps/dashboard/public/docs/`

### Docs Image Embeds
- [x] README: hero playground flow screenshot after architecture diagram
- [x] getting-started: x402 payment flow + endpoint picker screenshots
- [x] quickstart-agent: agent config, spend tracker, flow visualizer screenshots
- [x] example-agent-weather: flow visualizer + response panel screenshots
- [x] Merchant docs intentionally left image-free (no agent simulator screenshots in merchant-facing pages)

## Deployed — Docs Consolidation + Demo Integration (2026-03-03)

### Docs Single Source of Truth
- [x] In-app docs (`/dashboard/docs`) now load from markdown files instead of hardcoded JSX
- [x] Created `faq.md` for FAQ content previously hardcoded in JSX
- [x] Supported Chains table remains dynamic JSX (from `@pincerpay/core`)
- [x] Split `concepts.md` into 4 focused pages: x402, AP2, UCP, Chain Architecture

### Demo Site Integration
- [x] Added "Demo" nav link to site header (desktop + mobile), links to demo.pincerpay.com
- [x] Added "Try the Demo" CTA on landing page
- [x] Added demo callouts in 6 doc pages: getting-started, quickstart-agent, quickstart-merchant, agent-sdk, testing, FAQ
- [x] Fixed demo code snippet: `agent.fetch()` returns `Response`, added `.json()` step
- [x] Fixed tour: removed false claim that Squads SPN middleware enforces limits server-side
- [x] Labeled Squads Smart Account as "Coming Soon" in demo config panel and tour
- [x] Fixed "sub-second finality" to "sub-second latency"
- [x] Removed em dashes from demo copy

### Deploy Infrastructure
- [x] Fixed Vercel deploy scripts: `--cwd` doubled the path with server-side Root Directory setting
- [x] Deploy scripts now source `.vercel/env.sh` (gitignored) for project IDs
- [x] Added `.npmrc` with `script-shell=bash` for pnpm scripts on Windows

## Deployed — SDK Docs + Security + CI Fix (2026-03-03)

### SDK Docs Reconciliation
- [x] Fixed agent-demo merchant server: replaced non-existent curried `pay()` API with real `pincerpay({ routes })` middleware
- [x] Fixed dashboard docs page: corrected Agent SDK snippets (solanaPrivateKey, chains, policies)
- [x] Fixed setup wizard: corrected agent snippet + PINCERPAY_WALLET -> MERCHANT_ADDRESS env var
- [x] Fixed agent-demo README: updated merchant code examples to match real API
- [x] Updated examples to Solana-first patterns (agent-weather, express-merchant)

### Security & Dependencies
- [x] Patched hono 4.12.0 -> 4.12.3 (IP spoofing in AWS Lambda ALB conninfo)
- [x] Patched rollup 4.57.1 -> 4.59.0 (arbitrary file write via path traversal)
- [x] Patched minimatch 10.2.1 -> 10.2.3 (ReDoS via combinatorial backtracking)
- [x] Dismissed 8 remaining Dependabot alerts (transitive deps, no fix available)
- [x] Zero open Dependabot alerts

### CI / Deployment Pipeline
- [x] Fixed CI: marketing app `vitest` failing with no test files (added --passWithNoTests)
- [x] Fixed Railway auto-deploy: CI was blocking deploys since monorepo migration
- [x] Railway facilitator settings: root directory `/`, Dockerfile path `apps/facilitator/Dockerfile`, cleared custom build command
- [x] Deployed: Dashboard (Vercel `vercel --prod`), Facilitator (Railway `railway up`)

### Other
- [x] Added examples/* to pnpm workspace
- [x] Added initial Drizzle migration snapshot
- [x] Added quickstart docs (merchant + agent)
- [x] Added OpenGraph and Twitter image routes
- [x] Added Next.js merchant example

## Completed — Pre-Mainnet Preparation (2026-02-22)

### npm Package Publish Readiness (#49, #87)
- [x] Root MIT LICENSE file
- [x] Metadata added to all 7 publishable package.json files (license, description, keywords, repository, homepage, bugs, files)
- [x] `prepublishOnly` script added to all 7 publishable packages
- [x] Publish workflow updated: added @pincerpay/db + @pincerpay/solana to options, fixed `all` publish order (core db solana program agent merchant mcp)

### Developer Experience (#50, #53)
- [x] AGENTS.md created (repo structure, package graph, commands, architecture, env vars, conventions)
- [x] .cursor/rules/pincerpay.mdc created (tech stack, conventions, file patterns)
- [x] Root llms.txt created (matches dashboard public/llms.txt)
- [x] README updated with Examples section (express-merchant, agent-weather, pincerpay-agent-demo)
- [x] Closed stale issues #2 and #3

### OFAC Compliance Screening (#19)
- [x] Compliance module: types, OFAC SDN provider, Hono middleware, barrel export
- [x] SDN list parser: fetches Treasury sdnlist.txt, parses crypto addresses, Set-based O(1) lookup, daily refresh
- [x] Config: `OFAC_ENABLED` (default false) + `OFAC_REFRESH_INTERVAL_MS` (default 24h)
- [x] Facilitator integration: middleware on /v1/settle and /v1/settle-direct, health endpoint shows compliance status
- [x] DB schema: compliance_events table (address, result, reason, matched_list, transaction_id)
- [x] 10 compliance tests passing

### Squads SPN Integration (Phase S2)
- [x] Squads validation middleware: extracts payer from Solana tx, checks agent status + spending limits
- [x] Middleware returns 403 for revoked/paused agents, per-tx limit exceeded, exhausted spending limits
- [x] Settle route enhanced: auto-discovers Squads PDAs on agent registration (fire-and-forget)
- [x] 12 Squads validation tests passing
- [x] Middleware pipeline: CORS > Logging > Auth > Rate limit > OFAC > Squads > Route handler

### Validation
- [x] `pnpm typecheck` — zero errors (15 tasks, 10 packages)
- [x] `pnpm test` — 190 tests (180 passed, 10 skipped e2e devnet)
- [x] `pnpm build` — all packages build clean including Next.js dashboard

## Completed — Kora E2E Payment Test (2026-02-22)

E2E Kora gasless payment test PASSING on Solana devnet.
- TX: `3SFTEnHnAbfvNUm4UyBWuUXSBkWxkDkGTERvzcJaeTgAbnZd5wdX8y1H4Pmn3TPjGCaiZ42Mgs9Dhn51DWYSJvbC`
- Agent paid 0.001 USDC, Kora paid SOL gas
- Verify + Settle both pass against live facilitator

### Bugs fixed (all deployed):
1. **`accepted` field missing** in paymentPayload (x402 V2 scheme requires it)
2. **Wrong Kora response field** (`result.transaction` -> `result.signed_transaction`)
3. **Double-signing** (`sendTransaction` called Kora `signAndSendTransaction` on already-signed tx)
4. **Raw fetch for sendTransaction** (replaced `@solana/kit` `rpc.sendTransaction()` with raw JSON-RPC fetch)

## Last Deploy
- **Facilitator**: Railway — 2026-02-22T15:39Z (Kora gasless e2e passing)
- **Kora Signer**: Railway — 2026-02-22T07:15Z (new service, `resplendent-freedom`)
- **Dashboard**: Vercel — 2026-03-04 (MCP Server docs page)
- **Agent Demo**: Vercel — 2026-02-22 `demo.pincerpay.com` (Squads SPN spending limits parity)

## Phase 1 MVP — Deployed to Production

11 workspace packages build clean. 168 tests pass. Facilitator on Railway, dashboard on Vercel.

### Infrastructure
- **Facilitator**: `https://facilitator.pincerpay.com` — healthy, Solana devnet + Base Sepolia + Anchor program + Kora gasless
- **Kora Signer Node**: Railway internal (`resplendent-freedom.railway.internal:8080`)
- **Dashboard**: `https://pincerpay.com` (Vercel)
- **Database**: Supabase PostgreSQL with RLS enabled on all tables
- **Kora fee payer wallet**: `Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB` (devnet, 10 SOL + 20 USDC) — gasless signer
- **Solana facilitator wallet**: `53qkLfXNnLr9zy4utAvkgQz7DcuuPyQzNLyMj3TcR3zL` (devnet) — fallback only
- **EVM facilitator wallet**: `0x960E470581d17BcCd272F5Bd76A094077Cd907FE` (Base Sepolia) — optional
- **Anchor program**: `E53zfNo9DYxAUCu37bA2NakJMMbzPFszjgB5kPaTMvF3` (Solana devnet)
  - Authority: `GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm`
  - Config PDA: `Qa4Vp4kMKD5P8syNrc1ywz7WHiCt4poyykCKR21zLxP`
  - Test merchant PDA: `7Vvz1mCcNwcbSJ9Le1HXZ9ztYcmwN36zXK57evWRJ1dC`
  - Fee: 100 bps (1%) — currently deployed at 50 bps, will update on next deploy
- **CI**: GitHub Actions (typecheck → test → build)

### Completed
- [x] Monorepo scaffold (pnpm + Turborepo + tsconfig bases)
- [x] `packages/core` — chain configs (Base, Polygon, Solana), types, constants, Zod schemas
- [x] `packages/db` — Drizzle schema (merchants, api_keys, paywalls, transactions, webhook_deliveries, agents)
- [x] `apps/facilitator` — Hono x402 facilitator with EVM + Solana support
  - Routes: /verify, /settle, /settle-direct, /supported, /health, /status/:txHash
  - Middleware: API key auth, rate limiting (global + per-route), pino logging
  - Hooks: transaction recording, settlement logging, webhook dispatch with retry
  - Solana via @x402/svm + @solana/kit v5
  - CORS restriction, Zod body validation, graceful shutdown
  - Background workers: confirmation (batched Solana RPC), webhook retry, on-chain recorder — all with adaptive idle backoff
- [x] `packages/merchant` — Express + Hono middleware wrapping @x402/express and @x402/hono
- [x] `packages/agent` — PincerPayAgent with x402 fetch wrapper + spending policies + Solana support
- [x] `apps/dashboard` — Next.js 15 merchant dashboard (Vercel)
  - Supabase Auth, dashboard overview, transaction history, paywall CRUD
  - Settings, analytics, agent management, onboarding wizard, in-app docs
- [x] Dockerfile for facilitator with build assertions
- [x] Docker Compose for local dev (PostgreSQL + facilitator)
- [x] Vitest test suite (core, agent, merchant, facilitator, program, solana)
- [x] GitHub Actions CI pipeline (typecheck → test → build)
- [x] Deploy facilitator to Railway (Docker) + custom domain (facilitator.pincerpay.com)
- [x] Deploy dashboard to Vercel (pincerpay.com)
- [x] RLS enabled on all database tables
- [x] Webhook delivery with exponential backoff retry
- [x] Per-route rate limiting with Retry-After headers
- [x] Package READMEs for all 6 npm packages (merchant, agent, core, db, program, solana)
- [x] `/metrics` JSON endpoint (settlement/verify counters, latency percentiles, error tracking)
- [x] Logtail log aggregation (via `@logtail/pino`, activated by `LOGTAIL_SOURCE_TOKEN`)
- [x] Graceful shutdown hardened: health 503 during drain, reject new requests with Retry-After
- [x] Shutdown load test (10 concurrent requests + SIGTERM validation)

## Phase S1: Solana Parity — Complete

Solana-first architecture pivot. Solana is now the primary chain; EVM is optional.

## Phase S2: Kora Gasless + Squads Smart Accounts — Kora Deployed

Kora gasless integration deployed to devnet. Squads SPN session keys still pending.

### Kora Deployment — Complete (2026-02-22)
- [x] Generate Kora fee payer keypair (`Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB`)
- [x] Fund fee payer wallet: 10 SOL + 20 USDC (devnet)
- [x] Deploy Kora signer node on Railway (`infra/kora/`, Dockerfile, rust:1.87)
- [x] Set `KORA_RPC_URL` on facilitator (Railway private networking)
- [x] Verify: `/health` shows `kora.feePayer`, `/v1/supported` shows Kora signer address
- [x] Facilitator graceful fallback to local keypair if Kora unavailable
- [x] Fix Kora RPC method name: `getPayerSigner` (not `getFeePayer`)
- [x] Fix Kora signTransaction response field: `signed_transaction` (not `transaction`)
- [x] **E2E payment test** — PASSING (2026-02-22, TX `3SFTEnH...JvbC`)

### Squads SPN — Complete (2026-02-22)

**Phase A: App-Level Spending Limits**
- [x] Facilitator middleware enforces `maxPerTransaction` and `maxPerDay` for ALL agents (previously only Smart Account agents)
- [x] Daily spend enforcement via DB query (SUM of today's transactions)
- [x] Dashboard: editable spending limits form on agent detail page
- [x] Dashboard: inline limit editing on agent list table (click-to-edit)
- [x] Server action validation (non-negative integers, "clear" to remove)
- [x] SDK: `setPolicy()`, `getPolicy()`, `getDailySpend()` convenience methods

**Phase B: On-Chain Squads Smart Account via Dashboard**
- [x] Solana wallet adapter installed (Phantom + Solflare) with provider in root layout
- [x] Dashboard: "Create Smart Account" flow (derive PDAs, sign with wallet, persist to DB)
- [x] Dashboard: on-chain spending limit management (add with amount/period/destinations, view remaining, revoke)
- [x] Server actions for Squads operations (build, confirm, fetch state)
- [x] Kit v5 to web3.js v1 transaction bridge utilities
- [x] Multi-index spending limit support (`spendingLimitIndex` column, configurable per agent)
- [x] `SpendingLimitPeriod` enum exported from `@pincerpay/solana/squads`
- [x] SDK: `buildCreateSmartAccountInstruction()`, `buildAddSpendingLimitInstruction()`, `buildRevokeSpendingLimitInstruction()`

## Phase S3: On-Chain Anchor Facilitator — Deployed to Devnet

Anchor program + TypeScript client + hybrid facilitator.

### Completed (Infrastructure)
- [x] Anchor program built (293K .so) via WSL2 toolchain
- [x] Deployed to Solana devnet: `E53zfNo9DYxAUCu37bA2NakJMMbzPFszjgB5kPaTMvF3`
- [x] Program initialized (fee_bps=50, target 100) + test merchant registered
- [x] `ANCHOR_PROGRAM_ID` set on Railway facilitator
- [x] Facilitator redeployed with Anchor integration active
- [x] IDL discriminators corrected to match deployed binary
- [x] DB schema pushed + RLS re-enabled

## Remaining High Priority

### Production Hardening
- [x] #13 End-to-end payment test on devnet
- [x] #14 Monitoring + alerting for facilitator
- [x] #16 Graceful shutdown validation under load
- [x] #52 Package README optimization

### Manual Steps (Monitoring)
- [ ] Configure Better Stack uptime monitor: `https://facilitator.pincerpay.com/health`, 1-min interval
- [ ] Configure Better Stack Logs alerts: error rate >5% in 5 min, settlement p95 >30s
- [ ] Set `LOGTAIL_SOURCE_TOKEN` env var on Railway facilitator

## Phase S4: Transfer Hooks + Compliance
- [x] OFAC compliance screening (facilitator middleware, SDN list provider)
- [ ] Separate Anchor compliance program (Transfer Hook authority)
- [ ] OFAC screening in compressed accounts
- [ ] Dashboard compliance audit log

## Phase S5: Advanced
- [ ] Micropayment batching with ZK compression
- [ ] CCTP v2 EVM→Solana bridging
- [ ] Agent identity (DIDs, trust scores)

## MCP Server — v0.4.0

`@pincerpay/mcp` — MCP server for PincerPay. Works with Claude, Cursor, Windsurf, Copilot, Replit.

### Tools (20)
**Monitoring (no auth):** `list-supported-chains`, `estimate-gas-cost`, `check-facilitator-health`, `get-settlement-metrics`
**Operations (auth):** `check-transaction-status`, `verify-payment`, `list-transactions`
**Paywall CRUD (auth):** `list-paywalls`, `create-paywall`, `update-paywall`, `delete-paywall`
**Agent Management (auth):** `list-agents`, `update-agent`
**Webhook Observability (auth):** `list-webhooks`, `retry-webhook`
**Account (auth):** `get-merchant-profile`
**Scaffolding (no auth):** `validate-payment-config`, `scaffold-x402-middleware`, `scaffold-agent-client`, `generate-ucp-manifest`

### Resources (3)
- `chain://{shorthand}` — chain config template (6 chains)
- `pincerpay://openapi` — live OpenAPI spec
- `docs://pincerpay/{topic}` — embedded docs (getting-started, merchant, agent, troubleshooting, reference)

### Prompts (6)
- `get-started` — interactive onboarding, triages merchant vs agent vs troubleshooting
- `integrate-merchant` — merchant SDK integration guide (Express/Hono/Next.js)
- `integrate-agent` — agent SDK setup guide with base units conversion
- `debug-transaction` — transaction troubleshooting
- `manage-paywalls` — paywall CRUD orchestration
- `monitor-payments` — payment monitoring and failure investigation

### Transports
- stdio (default, for npx/Claude Desktop/Cursor)
- Streamable HTTP (--transport=http, for remote deployment)

## Agent Demo — Complete (Updated 2026-03-02)

Migrated into monorepo as `apps/agent-demo` (`@pincerpay/agent-demo`). Live at `demo.pincerpay.com`.

- Squads SPN spending limits parity: agent status (active/paused/revoked), correct error codes, Smart Account toggle with on-chain limit simulation
- Agent-side vs facilitator-side error flow differentiation
- UTC midnight daily reset countdown, on-chain limit progress bar
- Field names match SDK/facilitator (`maxPerTransaction`, `maxPerDay`)
- Live mode wires up `setPolicy()` on the agent SDK

## Branding — Complete

Nunito Sans font, `#F97316` orange primary, `#070300` warm black background, pincer claw logo. Applied to dashboard + agent demo.

## Marketing & Content — Complete (PR #89)

Docs, blog, and SEO infrastructure merged to dashboard:
- 6 doc pages (getting-started, concepts, merchant-sdk, agent-sdk, api-reference, testing)
- 1 blog post (why-we-built-pincerpay)
- llms.txt + llms-full.txt for AI discoverability
- SiteHeader with responsive mobile nav
- Server-side markdown (unified/remark/rehype), JSON-LD with XSS protection
- robots.txt, sitemap.xml, .well-known/ucp, .well-known/ai-plugin.json
- Closed #44 (Landing page refresh), #51 (llms.txt)

## Marketing Automation — Migrated (2026-03-02)

Migrated into monorepo as `apps/marketing` (`@pincerpay/marketing`). CLI content pipeline for content generation, review, and multi-channel publishing.

## Monorepo Consolidation (2026-03-02)

- [x] Import `pincerpay-agent-demo` via git subtree (history preserved)
- [x] Import `pincerpay-marketing-automation` via git subtree (history preserved)
- [x] Convert to workspace packages (`workspace:*` deps)
- [x] Agent SDK: replace stale Railway fallback URL with `DEFAULT_FACILITATOR_URL`
- [x] Program package: `PINCERPAY_PROGRAM_ID` now configurable via `ANCHOR_PROGRAM_ID` env var (#90)

## npm Publishing (#49) — Complete

- [x] All 5 packages published to npm v0.1.0 (core, solana, merchant, agent, mcp)
- [x] Granular access token configured (90-day expiry, @pincerpay scope)

## Distribution Strategy — 36 Open Issues

GitHub Issues (#49-#88) across 4 tiers. Closed #55 (LangChain), #62 (CrewAI), #87 (npm SEO), #88 (MCP directories).

## Blockers
- None
