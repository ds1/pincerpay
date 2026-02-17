# Project Status

Last updated: 2026-02-17

## Phase 1 MVP — Deployed to Production

All 6 workspace packages build clean. 112 tests pass (56 unique across src + dist). Facilitator on Railway, dashboard on Vercel.

### Infrastructure
- **Facilitator**: `https://pincerpayfacilitator-production.up.railway.app` — healthy, Solana devnet + Base Sepolia registered
- **Dashboard**: `https://pincerpay.com` (Vercel)
- **Database**: Supabase PostgreSQL with RLS enabled on all tables
- **Solana facilitator wallet**: `53qkLfXNnLr9zy4utAvkgQz7DcuuPyQzNLyMj3TcR3zL` (devnet: 10 SOL) — primary
- **EVM facilitator wallet**: `0x960E470581d17BcCd272F5Bd76A094077Cd907FE` (Base Sepolia: ~19 USDC + 0.049 ETH) — optional
- **CI**: GitHub Actions (typecheck → test → build)

### Completed
- [x] Monorepo scaffold (pnpm + Turborepo + tsconfig bases)
- [x] `packages/core` — chain configs (Base, Polygon, Solana), types, constants, Zod schemas
- [x] `packages/db` — Drizzle schema (merchants, api_keys, paywalls, transactions), NodeNext module resolution
- [x] `apps/facilitator` — Hono x402 facilitator with EVM + Solana support
  - Routes: /verify, /settle, /supported, /health, /status/:txHash
  - Middleware: API key auth, rate limiting, pino logging
  - Hooks: transaction recording, settlement logging, webhook dispatch
  - Solana via @x402/svm + @solana/kit v5
  - CORS restriction (production warning if unset), Zod body validation, graceful shutdown
  - Background confirmation worker (optimistic → confirmed/failed + gas tracking)
- [x] `packages/merchant` — Express + Hono middleware wrapping @x402/express and @x402/hono
  - EVM + Solana server scheme registration
  - Uses `DEFAULT_FACILITATOR_URL` constant (not hardcoded)
- [x] `packages/agent` — PincerPayAgent with x402 fetch wrapper + spending policies + Solana support
  - Spending policies enforced via x402Client hooks (onBeforePaymentCreation / onAfterPaymentCreation)
- [x] `apps/dashboard` — Next.js 15 merchant dashboard (Vercel)
  - Supabase Auth (login/signup/logout) via runtime SupabaseProvider
  - Dashboard overview with 30d stats
  - Transaction history table with pagination + clickable detail view
  - Paywall CRUD (create/toggle/delete) with pagination
  - Settings: merchant profile + API key management (create/revoke)
  - Analytics: recharts bar + line charts (volume by chain, daily volume)
  - Error boundaries, nav active state, wallet address validation
- [x] Dockerfile for facilitator with build assertions
- [x] Root `.dockerignore` for clean Docker builds
- [x] Docker Compose for local dev (PostgreSQL + facilitator)
- [x] Example apps (express-merchant, agent-weather)
- [x] Environment templates (.env.example)
- [x] Vitest test suite (core, agent, merchant, facilitator)
- [x] GitHub Actions CI pipeline (typecheck → test → build)
- [x] Supabase project setup + schema pushed via `pnpm db:push`
- [x] Deploy facilitator to Railway (Docker)
- [x] Deploy dashboard to Vercel (migrated from Railway)
- [x] Custom domain: pincerpay.com → Vercel
- [x] Fund facilitator wallet with testnet ETH + USDC on Base Sepolia
- [x] RLS enabled on all database tables
- [x] Agent test wallet funded: `0xDA335159D283F54005fE2b4cd0eB21F256f8B726` (1 USDC)

## Phase S1: Solana Parity — Complete

Solana-first architecture pivot. Solana is now the primary chain; EVM is optional.

### Completed
- [x] **Confirmation worker rewrite** — now handles both EVM (viem `getTransactionReceipt`) and Solana (`rpc.getSignatureStatuses` via @solana/kit v5 branded `signature()` type). Solana uses "confirmed" (2/3 stake voted) as sufficient finality, with "finalized" for high-value. Tracks slot numbers.
- [x] **Schema: gasToken + Solana fields** — transactions table now has `gas_token` (ETH/SOL/MATIC/USDC), `slot`, `priority_fee`, `compute_units` columns
- [x] **Config flip** — `SOLANA_PRIVATE_KEY` is required, `FACILITATOR_PRIVATE_KEY` (EVM) is optional. `SOLANA_NETWORKS` defaults to devnet; `EVM_NETWORKS` is optional.
- [x] **Default chain → Solana** — `resolveRouteChains` default changed from `["base"]` to `["solana"]` in merchant SDK (both Express + Hono middleware) and client
- [x] **Dashboard Solana support** — explorer links use Solana explorer format with cluster params, gas cost formatted per-token (SOL=9 decimals, ETH=18, USDC=6), shows slot/computeUnits/priorityFee for Solana txns
- [x] **Core types updated** — `Transaction` interface has `gasToken`, `slot`, `priorityFee`, `computeUnits`. Added `SolanaConfirmationLevel` type.
- [x] **Settle route gasToken** — records correct gas token (SOL/ETH/MATIC) based on chain namespace at settlement time
- [x] **Tests updated** — default chain tests updated (solana instead of base), Solana CAIP-2 resolution tests added, Solana chain property tests added. 56 unique tests pass (112 total across src + dist).

## Manual Steps Needed
- [ ] Set `CORS_ORIGINS` env var on Railway: `https://pincerpay.com,https://www.pincerpay.com`
- [ ] Add CNAME record `facilitator` → `pincerpayfacilitator-production.up.railway.app` in Vercel DNS
- [ ] Configure custom domain `facilitator.pincerpay.com` on Railway facilitator service
- [x] Generate Solana facilitator keypair and set `SOLANA_PRIVATE_KEY` on Railway
- [x] Push new schema to Supabase: `pnpm db:push` (adds gas_token, slot, priority_fee, compute_units columns)
- [x] Fund Solana facilitator wallet with devnet SOL (10 SOL)
- [x] Deploy facilitator to Railway with Solana support (fix: exclude tests from tsc build)

## Phase S2: Kora + Squads (Next)
- [ ] `packages/solana/` — Kora gasless integration
- [ ] `packages/solana/` — Squads SPN session key management
- [ ] Agent SDK: `SolanaAgent` class with Squads vault + session keys
- [ ] On-chain spending policy enforcement (replaces in-memory tracking)
- [ ] DB: `agents` table, Kora-specific fields

## Phase S3: On-Chain Facilitator
- [ ] `packages/solana-program/` — Anchor program with core instructions
- [ ] TypeScript program client
- [ ] Hybrid facilitator: on-chain for Solana, viem for EVM
- [ ] Anchor integration tests + E2E suite update

## Phase S4: Transfer Hooks + Compliance
- [ ] Separate Anchor compliance program (Transfer Hook authority)
- [ ] OFAC screening in compressed accounts
- [ ] Dashboard compliance audit log
- [ ] Merchant opt-in flow for Transfer Hook registration

## Phase S5: Advanced
- [ ] Micropayment batching with ZK compression
- [ ] CCTP v2 EVM→Solana bridging
- [ ] Solana Actions for human-approval flows
- [ ] ACK agent identity (DIDs, trust scores)

## Blockers
_None_
