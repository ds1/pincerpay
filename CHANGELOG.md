# Changelog

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
