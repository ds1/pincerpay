---
name: pincerpay-best-practices
description: Best practices for building PincerPay integrations. Use when implementing USDC paywalls, agent payment clients, x402 middleware, spending policies, or any PincerPay SDK integration.
---

PincerPay is an on-chain USDC payment gateway for AI agents using the x402 protocol (HTTP 402). Solana is the primary chain; Base and Polygon are optional EVM alternatives.

## ESM Requirement

Both `@pincerpay/merchant` and `@pincerpay/agent` are ESM-only. You must have `"type": "module"` in package.json or use `.mts` file extensions. Without this, you'll get `ERR_MODULE_NOT_FOUND`.

## Amounts: Route Prices vs Spending Policies

This is the #1 integration gotcha. Two different formats exist:

- **Route `price` fields** use human-readable USDC strings: `"0.01"` = 1 cent
- **Spending `policies`** use base unit strings (6 decimals): `"10000"` = 1 cent

Using `"0.10"` in a spending policy will cause `BigInt()` to throw at runtime.

| Human Amount | Route `price` | Policy value |
|-------------|---------------|--------------|
| $0.001 | `"0.001"` | `"1000"` |
| $0.01 | `"0.01"` | `"10000"` |
| $0.10 | `"0.10"` | `"100000"` |
| $1.00 | `"1.00"` | `"1000000"` |

Convert: multiply human amount x 1,000,000. Or use `toBaseUnits("0.01")` from `@pincerpay/merchant`.

## Security

- Add `.env*` to `.gitignore` — never commit API keys or private keys
- Store wallet keys in environment variables, not source code
- Use `pp_test_` API keys for devnet chains, `pp_live_` for mainnet

## Chain Matching

Both merchant and agent must use the same chain. If the merchant paywall is configured for `"solana-devnet"`, the agent must also have `"solana-devnet"` in its `chains` array. A mismatch produces a 402 response that the agent cannot fulfill.

## Devnet-First Development

Always develop and test on devnet chains before mainnet:

- **Solana**: `"solana-devnet"` (free devnet USDC, SOL from faucet.solana.com)
- **Base**: `"base-sepolia"` (testnet USDC from Circle faucet)

## Route Pattern Format

Paywall route patterns must follow `"METHOD /path"` format — uppercase HTTP method, single space, path starting with `/`. Examples: `"GET /api/weather"`, `"POST /api/submit"`.

## Framework Support

- **Next.js**: `import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs"` — uses Hono as a lightweight handler in a catch-all App Router route
- Install: `npm install @pincerpay/merchant hono`

## Role Routing

When integrating PincerPay, determine the user's role first:

- **Merchant** (accept payments): `scaffold-x402-middleware` -> `validate-payment-config` -> `generate-ucp-manifest`
- **Agent developer** (make payments): `scaffold-agent-client` -> `estimate-gas-cost`
- **Troubleshooting**: `debug-transaction` prompt with transaction hash

## Available MCP Tools by Category

**Discovery (no API key needed):** `list-supported-chains`, `estimate-gas-cost`, `check-facilitator-health`, `get-settlement-metrics`

**Scaffolding (no API key needed):** `scaffold-x402-middleware`, `scaffold-agent-client`, `validate-payment-config`, `generate-ucp-manifest`

**Paywall CRUD (API key required):** `list-paywalls`, `create-paywall`, `update-paywall`, `delete-paywall`

**Operations (API key required):** `list-transactions`, `check-transaction-status`, `verify-payment`

**Agent Management (API key required):** `list-agents`, `update-agent`

**Webhooks (API key required):** `list-webhooks`, `retry-webhook`

**Account (API key required):** `get-merchant-profile`
