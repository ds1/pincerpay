# @pincerpay/merchant

[![npm](https://img.shields.io/npm/v/@pincerpay/merchant?style=flat-square)](https://www.npmjs.com/package/@pincerpay/merchant)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/merchant?style=flat-square)](https://www.npmjs.com/package/@pincerpay/merchant)
[![license](https://img.shields.io/npm/l/@pincerpay/merchant?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Merchant SDK for accepting on-chain USDC payments from AI agents via the x402 protocol. Supports Express, Hono, and Next.js.

> **ESM Required:** Your project must have `"type": "module"` in package.json. This package is ESM-only.

## Install

```bash
npm install @pincerpay/merchant
```

## Quick Start

### Express

```typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
      "POST /api/analyze": {
        price: "0.10",
        chains: ["solana", "base"],
        description: "AI text analysis",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  res.json({ temp: 72, unit: "F" });
});

app.listen(3000);
```

### Hono

```typescript
import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant/hono";

const app = new Hono();

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
    },
  })
);

app.get("/api/weather", (c) => c.json({ temp: 72 }));

export default app;
```

### Next.js (Hono Adapter)

Next.js doesn't have native x402 middleware support. Use Hono as a lightweight handler inside a catch-all App Router route:

```typescript
// app/api/[...route]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { pincerpayHono } from "@pincerpay/merchant/hono";

const app = new Hono().basePath("/api");

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
    },
  })
);

app.get("/weather", (c) => c.json({ temp: 72 }));

export const GET = handle(app);
export const POST = handle(app);
```

Install: `npm install @pincerpay/merchant hono`

> **Note:** `basePath("/api")` must match the catch-all route location. Route handlers use paths relative to basePath (`/weather` serves `/api/weather`).

## API Reference

### `pincerpay(config): Express.RequestHandler`

Express middleware that intercepts requests matching configured routes and returns HTTP 402 with x402 payment requirements.

### `pincerpayHono(config): HonoMiddleware`

Hono middleware with identical behavior. Also used for Next.js via the Hono adapter pattern (see Next.js example above).

### `PincerPayClient`

Low-level client for direct facilitator API access.

```typescript
import { PincerPayClient } from "@pincerpay/merchant";

const client = new PincerPayClient({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_ADDRESS",
  facilitatorUrl: "https://facilitator.pincerpay.com", // default
  routes: {},
});

const result = await client.settle(paymentPayload, paymentRequirements);
const status = await client.getStatus(txHash);
const supported = await client.getSupported();
```

### Config

```typescript
interface PincerPayConfig {
  apiKey: string;
  merchantAddress: string;
  facilitatorUrl?: string; // defaults to https://facilitator.pincerpay.com
  routes: Record<string, RoutePaywallConfig>;
}

interface RoutePaywallConfig {
  price: string;        // USDC amount (e.g., "0.01")
  chain?: string;       // Chain shorthand (e.g., "solana", "base")
  chains?: string[];    // Multiple chains
  description?: string; // Human-readable description
}
```

### Utility Functions

```typescript
import { toBaseUnits, resolveRouteChains } from "@pincerpay/merchant";

toBaseUnits("0.01");              // "10000" (USDC has 6 decimals)
resolveRouteChains(routeConfig);  // ["solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"]
```

## Common Patterns

### Multi-chain pricing

```typescript
pincerpay({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_ADDRESS",
  routes: {
    "GET /api/data": {
      price: "0.05",
      chains: ["solana", "base", "polygon"],
      description: "Accept USDC on any supported chain",
    },
  },
});
```

### Free routes alongside paid routes

Routes not listed in `routes` pass through without payment. Only matching `METHOD /path` patterns trigger the 402 paywall.

```typescript
pincerpay({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_ADDRESS",
  routes: {
    "GET /api/premium": { price: "1.00", chain: "solana" },
    // GET /api/free is not listed — no paywall
  },
});
```

## Anti-Patterns

### Don't hardcode API keys

```typescript
// Bad
pincerpay({ apiKey: "pp_live_abc123...", ... });

// Good
pincerpay({ apiKey: process.env.PINCERPAY_API_KEY!, ... });
```

### Don't use the merchant SDK on the agent side

The merchant SDK is for servers accepting payments. Agents should use `@pincerpay/agent` to make payments.

### Don't set price to "0"

A price of "0" will still trigger the 402 flow. If a route should be free, omit it from the `routes` config.
