# Next.js Merchant Example

A minimal Next.js 15 app demonstrating PincerPay paywall on API route handlers using Hono.

## How it works

Hono is mounted inside a Next.js catch-all route handler (`src/app/api/[...path]/route.ts`). The `createPincerPayMiddleware` middleware (from `@pincerpay/merchant/nextjs`) intercepts requests to paywalled routes and returns `402 Payment Required` with x402 payment instructions. Free routes like `/api/health` pass through normally.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

2. Install dependencies (from the monorepo root):

```bash
pnpm install
```

3. Start the dev server:

```bash
pnpm --filter example-nextjs-merchant dev
```

4. Test:

```bash
# Free endpoint
curl http://localhost:3000/api/health
# {"status":"ok"}

# Paywalled endpoint (returns 402)
curl -i http://localhost:3000/api/weather
# HTTP/1.1 402 Payment Required
```

## Test with Agent SDK

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

const res = await agent.fetch("http://localhost:3000/api/weather");
console.log(await res.json());
// { temperature: 72, conditions: "sunny", ... }
```

## Endpoints

| Route | Price | Description |
|-------|-------|-------------|
| `GET /api/health` | Free | Health check |
| `GET /api/weather` | 0.001 USDC | Current weather data |
| `GET /api/joke` | 0.001 USDC | Random AI joke |

## Deploy

This example works with any Node.js hosting. For Vercel:

```bash
vercel deploy
```

Set `PINCERPAY_API_KEY` and `MERCHANT_ADDRESS` in your Vercel project environment variables.
