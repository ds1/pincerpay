---
title: "Example: Next.js Merchant"
description: Next.js 15 + Hono catch-all route handler with PincerPay paywall middleware.
order: 8.1
section: Examples
---

A minimal Next.js 15 app with paywalled API routes using Hono and the `createPincerPayMiddleware` middleware. Hono is mounted inside a catch-all route handler, so all `/api/*` routes run through PincerPay.

## How it works

Hono is mounted inside a Next.js catch-all route handler (`src/app/api/[...path]/route.ts`). The `createPincerPayMiddleware` middleware intercepts requests to paywalled routes and returns `402 Payment Required` with x402 payment instructions. Free routes like `/api/health` pass through normally.

## Endpoints

| Route | Price | Description |
|-------|-------|-------------|
| `GET /api/health` | Free | Health check |
| `GET /api/weather` | 0.001 USDC | Current weather data |
| `GET /api/joke` | 0.001 USDC | Random AI joke |

## Route handler

```typescript
// src/app/api/[...path]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

// Build-safe placeholder: Solana System Program (1...1, 32 bytes of zeros).
// Valid base58 so middleware init passes during `next build` when MERCHANT_ADDRESS
// is unset; never receives funds at runtime — supply a real value via env.
const PLACEHOLDER_SOLANA = "11111111111111111111111111111111";

const app = new Hono().basePath("/api");

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY ?? "pp_test_placeholder",
    merchantAddress: process.env.MERCHANT_ADDRESS ?? PLACEHOLDER_SOLANA,
    syncFacilitatorOnStart: false,
    routes: {
      "GET /api/weather": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Current weather data",
      },
      "GET /api/joke": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Random AI joke",
      },
    },
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/weather", (c) =>
  c.json({
    temperature: 72,
    conditions: "sunny",
    location: "San Francisco",
    timestamp: new Date().toISOString(),
  })
);

app.get("/joke", (c) =>
  c.json({
    setup: "Why did the AI cross the road?",
    punchline: "To get to the other inference.",
  })
);

export const GET = handle(app);
export const POST = handle(app);
```

## Setup

1. Copy `.env.example` to `.env.local` and fill in your PincerPay API key and Solana wallet address:

```bash
cp .env.example .env.local
```

2. Install dependencies from the monorepo root:

```bash
pnpm install
```

3. Start the dev server:

```bash
pnpm --filter example-nextjs-merchant dev
```

## Test with curl

```bash
# Free endpoint
curl http://localhost:3000/api/health
# {"status":"ok"}

# Paywalled endpoint (returns 402)
curl -i http://localhost:3000/api/weather
# HTTP/1.1 402 Payment Required
```

## Test with the Agent SDK

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

## Deploy

This example works with any Node.js hosting. For Vercel, set `PINCERPAY_API_KEY` and `MERCHANT_ADDRESS` in your project environment variables and deploy:

```bash
vercel deploy
```

## Related

- [GitHub source](https://github.com/ds1/pincerpay/tree/master/examples/nextjs-merchant)
- [Merchant SDK Reference](/docs/merchant-sdk)
- [Quickstart: Merchant](/docs/quickstart-merchant)
