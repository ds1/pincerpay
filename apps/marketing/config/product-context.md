# PincerPay Product Context

Use this as ground truth when generating content. Every claim must be backed by these facts.

## What PincerPay Is

PincerPay is an on-chain payment gateway for the agentic economy. AI agents pay for API resources with USDC stablecoins via the x402 protocol (HTTP 402). No card rails, no 3% fees, instant settlement. Solana-first, with optional EVM support (Base, Polygon).

## How It Works

1. Agent sends HTTP GET to a paywalled API endpoint
2. Server returns HTTP 402 with payment details (token, amount, chain, facilitator URL)
3. Agent SDK signs a USDC transfer and sends it to the facilitator for verification
4. Facilitator broadcasts the transaction, returns a receipt
5. Agent retries the original request with proof of payment
6. Server verifies receipt and returns the data

## Protocol Stack

Discovery (UCP) -> Trust (AP2) -> Settlement (x402) -> Chain Abstraction (Solana | Base | Polygon)

- **x402** (Coinbase, 5400+ GitHub stars): HTTP 402-based USDC payments
- **AP2** (Google, 60+ partners): Cryptographic mandate-based authorization
- **UCP** (Google + Shopify, 20+ partners): Agent-readable commerce discovery via /.well-known/ucp
- **A2A x402 Extension** (Google/Coinbase/EF): "Double-Lock" combining AP2 mandates + x402 payloads

## Key Components

- **`@pincerpay/merchant`** -- Express/Hono middleware. Add 3 lines to paywall any API endpoint.
- **`@pincerpay/agent`** -- Wraps fetch(). Handles 402 challenges automatically. 3 lines of code.
- **`@pincerpay/core`** -- Shared types, protocol definitions, chain utilities.
- **`@pincerpay/solana`** -- Solana-specific program interactions and utilities.
- **`@pincerpay/mcp`** -- MCP server (7 tools, 3 resources, 3 prompts for Claude/Cursor/Copilot).
- **Facilitator** -- Server that verifies payments, broadcasts transactions, settles on-chain.
- **Dashboard** -- Merchant dashboard at pincerpay.com for configuration, analytics, and agent management.

## Key Differentiators

- **No card rails**: Pure stablecoin settlement. No Visa/Mastercard/Stripe dependency. No 3% fees.
- **Non-custodial**: PincerPay never holds funds. Agents sign their own transactions.
- **Gas passthrough**: PincerPay never subsidizes gas. Agents pay in USDC via Kora (Solana) or meta-transactions (EVM).
- **Optimistic finality**: Sub-$1 transactions settle in ~200ms (mempool broadcast), before block confirmation.
- **Three-layer spending limits**: Client-side (SDK), server-side (facilitator), on-chain (Squads SPN).
- **Open protocols**: Built on x402, AP2, UCP. Not locked into any proprietary system.

## What Just Shipped (v0.14.0, Feb 22 2026)

### Squads SPN Spending Limits: Agent Operator Controls

Phase A (app-level limits):
- Facilitator enforces maxPerTransaction and maxPerDay for ALL registered agents on every payment
- Daily spend enforcement via real-time DB query
- Dashboard: editable spending limits on agent detail page + inline editing on agent list table
- SDK: setPolicy(), getPolicy(), getDailySpend() for runtime policy management

Phase B (on-chain Squads Smart Accounts via dashboard):
- Solana wallet adapter integrated into dashboard (Phantom + Solflare)
- Merchants connect wallet and create Squads Smart Accounts for their agents directly in PincerPay
- On-chain spending limits: set amount, period (one-time/daily/weekly/monthly), destination restrictions
- Live remaining balance display with auto-polling
- SDK: programmatic instruction builders for Smart Account creation, spending limit management

## Previous Major Releases

- 0.13.0: OFAC compliance screening, Squads validation middleware, npm publish readiness
- 0.12.0: Kora gasless integration (agents pay Solana gas in USDC instead of SOL)
- 0.11.0: Kora signer node Docker infrastructure
- 0.10.0: Orange rebrand (Nunito Sans, #F97316 primary, pincer claw logo)
- 0.9.0: MCP server (7 tools, 3 resources, 3 prompts for Claude/Cursor/Copilot/etc.)
- 0.8.0: Cost optimization (18x idle reduction, batched RPC, adaptive backoff), 1% settlement fee
- 0.7.0: Agent demo (demo.pincerpay.com)
- 0.6.0: Merchant onboarding wizard
- 0.5.0: Solana-first architecture pivot
- 0.4.0: Webhooks, confirmation worker, gas tracking, pagination
- 0.3.0: Production deployment (Railway + Vercel)

## Real Numbers (Use These)

- Transaction cost on Solana: ~$0.0001 (vs. Stripe's $0.30 + 2.9%)
- Optimistic settlement: ~200ms for sub-$1 transactions
- Cost comparison: 99.9% cheaper than card rails for micropayments
- Example: A $0.01 API call costs $0.31 on Stripe. On PincerPay: $0.01 + ~$0.0001.
- x402 protocol: 5400+ GitHub stars
- Settlement fee: 1% on USDC volume
- Tests: 78 passing

## Competitive Positioning

| | PincerPay | Skyfire | ACP (OpenAI/Stripe) | Visa TAP / Mastercard Agent Pay |
|---|---|---|---|---|
| Architecture | Non-custodial, open-protocol | Custodial, closed platform | Card-based, ~3% fees | Legacy card infra with agent wrappers |
| Agent support | Native (x402 + AP2 + UCP) | SDK-wrapped | Assumes human cardholder | Same fee structure, same delays |
| Cost per $0.01 txn | ~$0.0001 | ~$0.001 | ~$0.31 | ~$0.31 |
| Settlement | On-chain USDC (~200ms) | Internal ledger | T+1-3 bank transfer | T+1-3 bank transfer |
| Open standard | x402, AP2, UCP | Proprietary | Proprietary | Proprietary |
| Key risk | Requires crypto familiarity | Platform/custodial risk | Card-rail limitations | Legacy infrastructure |

## Revenue Model

- Settlement fees: 1% on USDC volume
- Facilitator hosting: SaaS subscription
- Micropayment batching: per-batch fees (future)
- Compliance-as-a-Service: tiered subscription for KYA/OFAC screening (future)

## Tech Stack

- Monorepo: pnpm + Turborepo
- Facilitator: Hono + @x402/core + @x402/svm + @solana/kit v5
- Dashboard: Next.js 15 + Tailwind CSS v4 + Supabase Auth + Solana Wallet Adapter
- Database: PostgreSQL (Supabase) + Drizzle ORM
- SDKs: @pincerpay/merchant (Express/Hono), @pincerpay/agent (fetch wrapper)
- Deploy: Railway (facilitator), Vercel (dashboard + demo)
- CI: GitHub Actions (typecheck, test, build). 78 tests passing.

## Brand

- Font: Nunito Sans
- Primary color: #F97316 (orange)
- Background: #070300 (warm black)
- Logo: Pincer claw mark
- Tagline: "On-chain payments for AI agents"
- One-liner: "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol."

## What PincerPay Is NOT

- Not a wallet provider (non-custodial, agents manage their own keys)
- Not a DeFi protocol (focused on commerce/payments, not trading)
- Not a blockchain (uses existing chains, Solana primary)
- Not just for crypto users (USDC is a regulated stablecoin, pegged 1:1 to USD)

## URLs

- Website + Dashboard + Docs: https://pincerpay.com
- Docs hub: https://pincerpay.com/docs (6 pages: getting-started, concepts, merchant-sdk, agent-sdk, api-reference, testing)
- Blog: https://pincerpay.com/blog
- Agent demo: https://demo.pincerpay.com
- Facilitator API: https://facilitator.pincerpay.com/health
- OpenAPI spec: https://facilitator.pincerpay.com/openapi.json
- LLM discovery: https://pincerpay.com/llms.txt and https://pincerpay.com/llms-full.txt
- UCP manifest: https://pincerpay.com/.well-known/ucp
- GitHub (main): https://github.com/ds1/pincerpay
- GitHub (agent demo): https://github.com/ds1/pincerpay-agent-demo

## Key Content Files (in main repo)

Docs (markdown, served at pincerpay.com/docs):
- apps/dashboard/content/docs/getting-started.md - 7-step quickstart
- apps/dashboard/content/docs/concepts.md - x402, AP2 mandates, UCP discovery, chain architecture
- apps/dashboard/content/docs/merchant-sdk.md - Express/Hono middleware setup
- apps/dashboard/content/docs/agent-sdk.md - Agent fetch wrapper, spending policies, Squads Smart Accounts
- apps/dashboard/content/docs/api-reference.md - Full facilitator API (endpoints, error codes, webhooks, rate limits)
- apps/dashboard/content/docs/testing.md - Devnet testing guide with faucet links

Blog:
- apps/dashboard/content/blog/why-we-built-pincerpay.md - Origin story / manifesto

Package READMEs:
- packages/agent/README.md - @pincerpay/agent
- packages/merchant/README.md - @pincerpay/merchant
- packages/core/README.md - @pincerpay/core
- packages/solana/README.md - @pincerpay/solana
- packages/mcp/README.md - @pincerpay/mcp
