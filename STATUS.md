# Project Status

Last updated: 2026-02-22

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
- **Dashboard**: Vercel — 2026-02-20T22:46Z (docs, blog, SEO, llms.txt, SiteHeader, server-side markdown, dependabot patches)
- **Agent Demo**: Vercel — 2026-02-20 `demo.pincerpay.com` (rebrand: matching orange identity)

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

### Remaining
- [ ] Squads SPN session key integration
- [ ] On-chain spending policies

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
- [ ] Separate Anchor compliance program (Transfer Hook authority)
- [ ] OFAC screening in compressed accounts
- [ ] Dashboard compliance audit log

## Phase S5: Advanced
- [ ] Micropayment batching with ZK compression
- [ ] CCTP v2 EVM→Solana bridging
- [ ] Agent identity (DIDs, trust scores)

## MCP Server — Complete

`@pincerpay/mcp` — MCP server for PincerPay. Works with Claude, Cursor, Windsurf, Copilot, Replit.

### Tools (7)
- `list-supported-chains` — chain configs (local or live facilitator)
- `check-transaction-status` — query tx status (auth required)
- `estimate-gas-cost` — gas estimates per chain
- `validate-payment-config` — validate merchant config JSON
- `scaffold-x402-middleware` — generate Express/Hono middleware
- `scaffold-agent-client` — generate agent fetch wrapper
- `generate-ucp-manifest` — create /.well-known/ucp manifest

### Resources (3)
- `chain://{shorthand}` — chain config template (6 chains)
- `pincerpay://openapi` — live OpenAPI spec
- `docs://pincerpay/{topic}` — embedded docs (getting-started, merchant, agent)

### Prompts (3)
- `integrate-merchant` — merchant SDK integration guide
- `integrate-agent` — agent SDK setup guide
- `debug-transaction` — transaction troubleshooting

### Transports
- stdio (default, for npx/Claude Desktop/Cursor)
- Streamable HTTP (--transport=http, for remote deployment)

### Ready to publish
- [ ] `npm publish` via GitHub Actions workflow

## Agent Demo — Complete

Standalone demo project at [`pincerpay-agent-demo`](https://github.com/ds1/pincerpay-agent-demo). Live at `demo.pincerpay.com`.

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

## Distribution Strategy — 40 Issues Created

40 GitHub Issues (#49-#88) across 4 tiers from distribution strategy. See GitHub Issues for full list.

## Blockers
_None_
