---
title: Getting Started
description: Go from zero to a working PincerPay integration in 5 minutes.
order: 1
section: Overview
---

PincerPay is an x402 payment gateway. Merchants add middleware to accept USDC; agents wrap fetch calls to pay automatically. This guide gets you from zero to a working integration in 5 minutes.

> **Want to see it first?** The [interactive demo](https://demo.pincerpay.com) walks through the full payment flow in your browser, no wallet or code required.

## How It Works

```
Agent requests resource
        |
        v
Merchant returns HTTP 402 + payment requirements
        |
        v
Agent signs USDC transaction
        |
        v
PincerPay Facilitator verifies + broadcasts transaction
        |
        v
Merchant delivers resource
```

1. An AI agent sends a request to your API endpoint
2. The PincerPay middleware intercepts the request and returns `402 Payment Required` with pricing info
3. The agent's PincerPay client automatically signs a USDC transfer
4. The PincerPay Facilitator verifies the payment and broadcasts the transaction on-chain
5. Your middleware confirms payment and allows the request through

![The x402 payment flow in the interactive playground](/docs/playground-flow.png)

## Quick Start

### 1. Sign Up

Create an account at [pincerpay.com/signup](https://pincerpay.com/signup). You'll land in the merchant dashboard.

### 2. Create Your Merchant Profile

Go to **Settings** and fill in:
- **Business name** — displayed to agents
- **Wallet address** — your Solana (or EVM) address for receiving USDC
- **Supported chains** — select `solana` (recommended), or add `base` / `polygon` for EVM

### 3. Generate an API Key

In **Settings**, scroll to API Keys and click **Generate Key**. Copy it — it's shown only once. The key format is `pp_live_xxxxxxxxxxxx...`.

### 4. Create a Paywall

Go to **Paywalls** and click **New Paywall**:
- **Endpoint** — the route pattern, e.g. `GET /api/weather`
- **Price** — amount in USDC, e.g. `0.01`
- **Description** — what the agent gets (shown in the 402 response)

### 5. Install the Merchant SDK

```bash
npm install @pincerpay/merchant
```

### 6. Add Middleware

Three lines of Express middleware:

```typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  res.json({ temp: 72, condition: "sunny" });
});

app.listen(3000);
```

### 7. Test It

Install the agent SDK and run a test payment:

```bash
npm install @pincerpay/agent
```

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

const res = await agent.fetch("http://localhost:3000/api/weather");
const data = await res.json();
console.log(data); // { temp: 72, condition: "sunny" }
```

Check the **Transactions** page in your dashboard to see the payment.

![Merchant endpoints with per-request USDC pricing](/docs/endpoint-picker.png)

## Examples

Working examples you can clone and run locally:

- [Next.js Merchant](/docs/example-nextjs-merchant) — Hono catch-all route handler with paywalled endpoints in a Next.js 15 app
- [Express Merchant](/docs/example-express-merchant) — Express server with free and paywalled routes at different price tiers
- [Weather Agent](/docs/example-agent-weather) — AI agent with spending policies that pays for weather data automatically
