---
title: Merchant SDK
description: Accept USDC payments from AI agents with Express or Hono middleware.
order: 2
section: SDKs
---

The `@pincerpay/merchant` package provides middleware for Express and Hono that handles the full x402 payment flow — returning 402 challenges, verifying payment proofs, and confirming settlement.

## Installation

```bash
npm install @pincerpay/merchant
```

## Express

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
      "GET /api/forecast": {
        price: "0.05",
        chain: "solana",
        description: "7-day forecast",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  res.json({ temp: 72, condition: "sunny" });
});

app.listen(3000);
```

## Hono

```typescript
import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant";

const app = new Hono();

app.use(
  "*",
  pincerpayHono({
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

app.get("/api/weather", (c) => {
  return c.json({ temp: 72, condition: "sunny" });
});

export default app;
```

## Configuration

The `pincerpay()` / `pincerpayHono()` functions accept a `PincerPayConfig` object:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your PincerPay API key (`pp_live_...`) |
| `merchantAddress` | `string` | Yes | Your wallet address for receiving USDC |
| `facilitatorUrl` | `string` | No | Override facilitator URL (default: `https://facilitator.pincerpay.com`) |
| `routes` | `Record<string, RoutePaywallConfig>` | Yes | Map of endpoint patterns to paywall config |

### Route Configuration

Each route in `routes` accepts:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `price` | `string` | Yes | Price in USDC (e.g. `"0.01"`) |
| `chain` | `string` | No | Chain shorthand (default: `"solana"`) |
| `chains` | `string[]` | No | Multiple chains the agent can pay on |
| `description` | `string` | No | Description shown to agents in 402 response |

### Supported Chains

| Shorthand | Network | Use |
|-----------|---------|-----|
| `solana` | Solana Mainnet | Production |
| `solana-devnet` | Solana Devnet | Testing |
| `base` | Base Mainnet | Production (EVM) |
| `base-sepolia` | Base Sepolia | Testing (EVM) |
| `polygon` | Polygon Mainnet | Production (EVM) |
| `polygon-amoy` | Polygon Amoy | Testing (EVM) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PINCERPAY_API_KEY` | Yes | Your API key from the dashboard |

## Helpers

### `toBaseUnits()`

Convert human-readable USDC to base units (6 decimals):

```typescript
import { toBaseUnits } from "@pincerpay/merchant";

toBaseUnits("0.01");  // "10000"
toBaseUnits("1.00");  // "1000000"
toBaseUnits("10.00"); // "10000000"
```

### USDC Amount Reference

| Human-Readable | Base Units |
|----------------|------------|
| $0.01 | `"10000"` |
| $0.10 | `"100000"` |
| $1.00 | `"1000000"` |
| $10.00 | `"10000000"` |
