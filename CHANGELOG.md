# Changelog

## 0.5.0 — 2026-02-16

### Phase S1: Solana-First Architecture

Solana is now the primary settlement chain. EVM chains remain supported as an optional compatibility layer.

- **Confirmation worker: Solana support** — rewrote `confirmation.ts` to handle both EVM (viem `getTransactionReceipt`) and Solana (`rpc.getSignatureStatuses` via @solana/kit v5). Uses branded `signature()` type, `rpc.method().send()` pattern. Solana "confirmed" (2/3 stake voted) treated as sufficient finality; tracks slot numbers per transaction.
- **Schema: Solana-specific columns** — transactions table gains `gas_token` (ETH/SOL/MATIC/USDC with default "ETH" for backward compat), `slot`, `priority_fee`, `compute_units`
- **Config: Solana-first defaults** — `SOLANA_PRIVATE_KEY` now required (was optional), `FACILITATOR_PRIVATE_KEY` (EVM) now optional (was required). `SOLANA_NETWORKS` defaults to devnet; `EVM_NETWORKS` is optional.
- **Default chain: Solana** — `resolveRouteChains` fallback changed from `["base"]` to `["solana"]` across merchant SDK (Express, Hono, client)
- **Settle route: gasToken tracking** — records correct gas token (SOL/ETH/MATIC) based on chain namespace
- **Core types** — `Transaction` interface extended with `gasToken`, `slot`, `priorityFee`, `computeUnits`. New `SolanaConfirmationLevel` type.
- **Dashboard: Solana display** — Solana explorer links with cluster params, gas cost formatted per-token decimals (SOL=9, ETH=18, USDC=6), slot/computeUnits/priorityFee shown for Solana transactions
- **Tests** — 56 unique tests pass (112 across src + dist). Updated default chain assertions, added Solana CAIP-2 resolution tests, Solana chain property tests.

## 0.4.0 — 2026-02-16

### Critical & High Gap Fixes

Addressed 9 of 10 critical/high gaps from `_planning/gaps.md`. Rate limiter deferred to Phase 2.

- **CORS production warning** — facilitator logs warning on startup when `NODE_ENV=production` and `CORS_ORIGINS` is unset
- **Facilitator URL constant** — merchant middleware (Express + Hono) now imports `DEFAULT_FACILITATOR_URL` from `@pincerpay/core` instead of hardcoding
- **Solana in merchant SDK** — added `@x402/svm` dependency, registered `ExactSvmScheme` alongside `ExactEvmScheme` in both Express and Hono middleware
- **Agent spending policies enforced** — `x402Client.onBeforePaymentCreation` hook checks `checkPolicy()` before signing; `onAfterPaymentCreation` calls `recordSpend()`. Policies actually block overspending now.
- **Webhook dispatch** — after successful settlement, facilitator POSTs transaction details to merchant's `webhookUrl` (fire-and-forget). Auth middleware now fetches `webhookUrl` from merchants table.
- **Dashboard pagination** — transactions and paywalls pages use `offset`/`limit` with Prev/Next controls. Count query for total pages.
- **Transaction confirmation worker** — background loop polls chain every 15s for "optimistic" transaction receipts. Updates status to "confirmed" or "failed", sets `confirmedAt` timestamp.
- **Gas cost tracking** — confirmation worker extracts `gasUsed * effectiveGasPrice` from EVM receipts, stores in `gasCost` column (native token wei). USDC conversion deferred to Phase 2.
- **Schema update** — `gasCost` column comment updated to clarify units: native token base units (wei for EVM)

## 0.3.3 — 2026-02-16

### E2E Payment Flow Test + Merchant Middleware Fixes

- **E2E test** (`apps/facilitator/src/__tests__/e2e.test.ts`) — full payment flow:
  - Spins up 3 localhost HTTP servers (mock RPC, facilitator, merchant)
  - Exercises: agent request → 402 challenge → EVM signature → facilitator verify/settle → DB insert → 200 response
  - Real EVM cryptography with mocked blockchain RPC and database
  - 4 test cases: payment flow, DB recording, non-paywalled passthrough, health check
- **Fixed merchant middleware** (Express + Hono) — two bugs that broke production:
  - Missing `ExactEvmScheme` registration → `RouteConfigurationError` on first paywalled request
  - Price passed as `AssetAmount` stripped EIP-712 domain parameters (name, version) → client signing failure
  - Now passes price as `Money` string, lets the EVM server scheme handle conversion + domain params
- **Test count**: 47 → 51 unique tests (102 counting src + dist mirrors)

## 0.3.2 — 2026-02-16

### Fix Dashboard on Vercel

- **Fixed Vercel serverless crash** on all `/dashboard` pages
  - Added `serverExternalPackages: ["postgres"]` — postgres.js uses Node.js `net`/`tls` for TCP which Vercel's bundler mangles
  - Added `ssl: 'require'` for Supabase pooler connections (port 6543) — pooler requires TLS
  - Added explicit `DATABASE_URL` validation with clear error message
  - Fixed `DATABASE_URL` env var on Vercel (was hostname-only, not a full connection URI)

## 0.3.1 — 2026-02-16

### Dashboard Migration: Railway → Vercel

- **Migrated dashboard from Railway (Docker) to Vercel** for zero-config Next.js deploys
  - Removed `Dockerfile`, `standalone` output mode, `outputFileTracingRoot`
  - Removed root layout `force-dynamic` (only needed to prevent Docker prerender crashes)
  - Added `vercel.json` for monorepo build config (Turborepo filter + install command)
  - Added env vars to `turbo.json` for Vercel's Turborepo integration
- **Deleted Railway dashboard service** — facilitator remains on Railway
- **DNS updated**: `pincerpay.com` A record → Vercel (`216.150.1.1`)
- **Database**: Switched `DATABASE_URL` to Supabase connection pooler (port 6543) for serverless compatibility

## 0.3.0 — 2026-02-16

### Production Deployment

- **Facilitator deployed** to Railway (Docker) — `https://pincerpayfacilitator-production.up.railway.app`
  - Base Sepolia EVM registered, health check passing
  - Wallet funded: 0x960E…07FE (~19 USDC + 0.049 ETH)
- **Dashboard deployed** to Railway (Docker, Next.js standalone output) — `https://pincerpay.com`
  - Custom domain configured with SSL
  - Supabase Auth working (login/signup/logout)
- **Docker build fixes**:
  - Switched dashboard to Next.js standalone output mode for monorepo Docker builds
  - Fixed ESM module resolution (`NodeNext`) in db package to ensure `.js` extensions in compiled output
  - Added build-time assertions in Dockerfiles to catch missing `.js` extensions
  - Root `.dockerignore` to reduce Docker context
- **Runtime Supabase config**: Created SupabaseProvider (React context) so client-side code gets Supabase URL/key at runtime via server component props instead of build-time `NEXT_PUBLIC_*` inlining
- **Middleware hardening**: Resilient error handling, runtime env var fallbacks
- **Database security**: RLS enabled on all 4 tables (merchants, api_keys, paywalls, transactions)
- **Landing page**: Updated copy to merchant-friendly messaging
- **CI fix**: Handle missing Supabase env vars during `next build` prerendering
- **Agent test wallet**: Generated and funded `0xDA33…8726` with 1 USDC on Base Sepolia
- **Supabase project**: Schema pushed via `pnpm db:push`, RLS enabled

## 0.2.0 — 2026-02-15

### Hardening + Solana + Testing + Dashboard Polish

- **Solana chain support** via @x402/svm + @solana/kit v5
  - Facilitator: `setupSolanaFacilitator()` with `registerExactSvmScheme`
  - Agent SDK: `PincerPayAgent.create()` async factory for Solana wallets
  - Config: `SOLANA_PRIVATE_KEY` + `SOLANA_NETWORKS` env vars
- **Testing infrastructure**: Vitest workspace with 47 tests across 5 suites
  - Core: chain resolution, CAIP-2 parsing, Zod schema validation
  - Agent: spending policy enforcement (per-tx + daily limits)
  - Merchant: route config transformation, base unit conversion
  - Facilitator: rate limiter middleware
- **GitHub Actions CI**: typecheck → test → build pipeline
- **Dashboard improvements**:
  - Logout button + nav active state (extracted client-side sidebar)
  - Error boundary for dashboard routes
  - Analytics: recharts bar chart (volume by chain) + line chart (daily volume)
  - Paywall CRUD: create, toggle, delete paywalls from UI
  - Transaction detail page with explorer link
  - EVM wallet address validation in merchant settings
- **Facilitator hardening**:
  - CORS origin restriction via `CORS_ORIGINS` env var
  - Zod request body validation on verify/settle routes
  - Auth error logging with IP + key prefix
  - Graceful DB shutdown on SIGTERM/SIGINT
  - `.dockerignore` to reduce Docker context size
- **DB schema**: unique constraint on paywalls, composite analytics index on transactions
- **Docker Compose**: local dev with PostgreSQL + facilitator

## 0.1.0 — 2026-02-15

### Phase 1 MVP Implementation

- **Monorepo scaffold**: pnpm workspaces + Turborepo + shared tsconfig
- **@pincerpay/core**: Chain configs (Base, Polygon, Solana mainnet + testnets), TypeScript types, Zod schemas, USDC addresses, CAIP-2 chain registry
- **@pincerpay/db**: Drizzle ORM schema — merchants, api_keys, paywalls, transactions tables with indexes
- **@pincerpay/facilitator**: Hono-based x402 facilitator
  - Registers @x402/evm exact payment scheme for Base + Polygon
  - POST /v1/verify, POST /v1/settle, GET /v1/supported, GET /health, GET /v1/status/:txHash
  - API key authentication, rate limiting, structured pino logging
  - Facilitator hooks for tx recording + settlement logging
  - Optimistic finality for sub-$1 transactions
- **@pincerpay/merchant**: Server-side SDK
  - Express middleware (`pincerpay()`) wrapping @x402/express
  - Hono middleware (`pincerpayHono()`) wrapping @x402/hono
  - Dead-simple route config: `{ "GET /api/data": { price: "0.01", chain: "base" } }`
  - PincerPayClient for direct facilitator API access
- **@pincerpay/agent**: Client-side SDK
  - PincerPayAgent class with payment-enabled `fetch()` wrapping @x402/fetch
  - EVM wallet support via viem + @x402/evm client scheme
  - Spending policy enforcement (per-transaction and daily limits)
- **@pincerpay/dashboard**: Next.js 15 merchant dashboard
  - Supabase Auth (email/password login + signup)
  - Dashboard overview with 30d volume, transaction count, confirmation rate
  - Transaction history table
  - Paywall configuration display
  - Settings: merchant profile editor + API key management (create/revoke)
  - Analytics: volume by chain, daily volume chart
- **Examples**: express-merchant and agent-weather demo apps
- **Deploy config**: Dockerfile for facilitator, .env.example templates
