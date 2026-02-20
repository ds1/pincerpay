# Project Status

Last updated: 2026-02-20

## Last Deploy
- **Facilitator**: Railway — 2026-02-20T07:09Z (adaptive workers, batched RPC, cached viem clients, worker nudge API)

## Phase 1 MVP — Deployed to Production

11 workspace packages build clean. 69 tests pass. Facilitator on Railway, dashboard on Vercel.

### Infrastructure
- **Facilitator**: `https://facilitator.pincerpay.com` — healthy, Solana devnet + Base Sepolia + Anchor program
- **Dashboard**: `https://pincerpay.com` (Vercel)
- **Database**: Supabase PostgreSQL with RLS enabled on all tables
- **Solana facilitator wallet**: `53qkLfXNnLr9zy4utAvkgQz7DcuuPyQzNLyMj3TcR3zL` (devnet) — primary
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

## Phase S1: Solana Parity — Complete

Solana-first architecture pivot. Solana is now the primary chain; EVM is optional.

## Phase S2: Kora Gasless + Squads Smart Accounts — Code Complete

Kora gasless integration + Squads Smart Account spending policies.

### Manual Steps Remaining
- [ ] Deploy Kora signer node on Railway as separate service (#1)
- [ ] Fund Kora fee payer wallet with SOL + USDC on devnet (#2)
- [ ] Set `KORA_RPC_URL` on facilitator Railway service (#3)

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
- [ ] #13 End-to-end payment test on devnet
- [ ] #14 Monitoring + alerting for facilitator
- [ ] #16 Graceful shutdown validation under load

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

Standalone demo project at [`pincerpay-agent-demo`](https://github.com/ds1/pincerpay-agent-demo).

## Blockers
_None_
