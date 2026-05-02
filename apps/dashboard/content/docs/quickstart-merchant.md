---
title: "Quickstart: Merchant"
description: Accept your first USDC payment from an AI agent in under 10 minutes.
order: 1.5
section: Guides
---

This tutorial walks you through creating a paywalled API endpoint that accepts USDC payments from AI agents. You'll have a working server accepting payments on Solana devnet by the end.

## Prerequisites

- **Node.js 22+** (`node --version`)
- **A Solana wallet** with a devnet address (Phantom, Solflare, or `solana-keygen`)
- **A PincerPay account** with an API key ([sign up](https://pincerpay.com/signup))

## Step 1: Create the project

```bash
mkdir my-merchant && cd my-merchant
npm init -y
npm pkg set type=module
npm install @pincerpay/merchant hono @hono/node-server
npm install -D tsx typescript
```

Create a `.env` file:

```bash
PINCERPAY_API_KEY=pp_live_your_api_key_here
MERCHANT_ADDRESS=YourSolanaWalletAddress
```

## Step 2: Write the server

Create `server.ts`:

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();

// Add PincerPay middleware — this intercepts requests and returns
// 402 Payment Required for paywalled routes
app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    routes: {
      "GET /api/weather": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Current weather data",
      },
    },
  })
);

// Free endpoint — no paywall
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Paywalled endpoint — middleware handles 402/settlement
app.get("/api/weather", (c) =>
  c.json({
    temperature: 72,
    conditions: "sunny",
    location: "San Francisco",
    timestamp: new Date().toISOString(),
  })
);

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`Merchant running at http://localhost:${info.port}`);
  console.log("  GET /api/health   — free");
  console.log("  GET /api/weather  — 0.001 USDC (Solana Devnet)");
});
```

> **Multi-chain merchants:** swap the `merchantAddress` line for `merchantAddresses: { "solana-devnet": process.env.MERCHANT_ADDRESS_SOLANA!, "polygon-amoy": process.env.MERCHANT_ADDRESS_POLYGON! }` and list `chains: ["solana-devnet", "polygon-amoy"]` on each route. See [Merchant SDK → Multi-chain Receiving Wallets](/docs/merchant-sdk#multi-chain-receiving-wallets).

## Step 3: Run the server

```bash
npx tsx --env-file=.env server.ts
```

Expected output:

```
Merchant running at http://localhost:3001
  GET /api/health   — free
  GET /api/weather  — 0.001 USDC (Solana Devnet)
```

## Step 4: Test with curl

The free endpoint returns data directly:

```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

The paywalled endpoint returns `402 Payment Required` with payment instructions:

```bash
curl -i http://localhost:3001/api/weather
```

```
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "payTo": "YourSolanaWalletAddress",
    "description": "Current weather data"
  }]
}
```

This is the x402 protocol in action. The `amount` is in USDC base units (6 decimals), so `1000` = 0.001 USDC.

## Step 5: Test with the Agent SDK

In a second terminal, create a test agent:

```bash
mkdir my-agent && cd my-agent
npm init -y
npm install @pincerpay/agent
npm install -D tsx typescript
```

Create `agent.ts`:

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

async function main() {
  const agent = await PincerPayAgent.create({
    chains: ["solana-devnet"],
    solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
    policies: [
      {
        maxPerTransaction: "100000",  // 0.10 USDC max per payment
        maxPerDay: "1000000",         // 1.00 USDC max per day
      },
    ],
  });

  console.log(`Agent address: ${agent.solanaAddress}`);

  // agent.fetch() handles the 402 flow automatically
  const response = await agent.fetch("http://localhost:3001/api/weather");
  const data = await response.json();
  console.log("Weather data:", data);
}

main().catch(console.error);
```

Fund the agent's Solana address with devnet SOL and USDC:

- **SOL**: `solana airdrop 1 <agent-address> --url devnet`
- **USDC**: Use the [Circle faucet](https://faucet.circle.com) (select Solana, Devnet, USDC)

Run the agent:

```bash
AGENT_SOLANA_KEY=your_base58_private_key npx tsx agent.ts
```

Expected output:

```
Agent address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
Weather data: {
  "temperature": 72,
  "conditions": "sunny",
  "location": "San Francisco",
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

The agent automatically detected the 402, signed a USDC transfer, submitted it to the facilitator, and retried the request with proof of payment.

## Next.js (App Router) Variant

Drop the same middleware into a catch-all App Router route:

```typescript
// app/api/[...route]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono().basePath("/api");

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    syncFacilitatorOnStart: false, // avoids build-time network call during prerendering
    routes: {
      "GET /api/weather": { price: "0.001", chain: "solana-devnet", description: "Weather data" },
    },
  })
);

app.get("/weather", (c) => c.json({ temp: 72, condition: "sunny" }));

export const GET = handle(app);
export const POST = handle(app);
```

## Troubleshooting

**402 response is empty or missing `accepts`**: Check that your `PINCERPAY_API_KEY` is valid. An invalid key will cause the middleware to skip paywall logic.

**Agent gets "insufficient balance"**: Fund the agent's Solana address with devnet USDC via the [Circle faucet](https://faucet.circle.com).

**Agent gets "policy violation"**: The payment amount exceeds your `maxPerTransaction` or `maxPerDay` policy. Increase the limits or lower the price.

## Next Steps

- [Interactive Demo](https://demo.pincerpay.com) to see what agents experience when hitting your paywalled API
- [Merchant SDK Reference](/docs/merchant-sdk) for the full configuration API
- [Next.js Example](/docs/example-nextjs-merchant) for App Router integration with Hono
- [Express Example](/docs/example-express-merchant) for a standalone Express server with multiple price tiers
- [Testing Guide](/docs/testing) for devnet/testnet setup
