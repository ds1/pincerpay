# @pincerpay/merchant

[![npm](https://img.shields.io/npm/v/@pincerpay/merchant?style=flat-square)](https://www.npmjs.com/package/@pincerpay/merchant)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/merchant?style=flat-square)](https://www.npmjs.com/package/@pincerpay/merchant)
[![license](https://img.shields.io/npm/l/@pincerpay/merchant?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Merchant SDK for accepting on-chain USDC payments from AI agents via the [x402 protocol](https://x402.org). Ships a Hono middleware that runs natively in Hono apps and inside Next.js App Router via `hono/vercel`.

> **ESM Required:** Your project must have `"type": "module"` in package.json. This package is ESM-only.

## Install

```bash
npm install @pincerpay/merchant hono
```

## Quick Start

### Hono

```typescript
import { Hono } from "hono";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();

app.use(
  "*",
  createPincerPayMiddleware({
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

app.get("/api/weather", (c) => c.json({ temp: 72, unit: "F" }));

export default app;
```

### Next.js (App Router)

Next.js doesn't have native x402 middleware support. Use Hono as a lightweight handler inside a catch-all App Router route:

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
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    syncFacilitatorOnStart: false, // Avoids build-time network call during prerendering
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

> **Note:** `basePath("/api")` must match the catch-all route location. Route handlers use paths relative to basePath (`/weather` serves `/api/weather`).

### Express

Express adapter is on the roadmap. Use Hono today — it runs anywhere Express does and is a drop-in for most paywall workloads. Track [the Express adapter issue](https://github.com/ds1/pincerpay/issues) for the upcoming release.

## Multi-chain Receiving Wallets

> **How routing works:** Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. **No cross-chain conversion happens.** If you accept Solana and Polygon and an agent pays on Polygon, USDC arrives in your Polygon wallet.

Solana and EVM addresses are categorically different formats — a single string can't hold both. Use `merchantAddresses` to bind one wallet per chain:

```typescript
// Single-chain merchant (legacy — still supported)
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm",
  routes: {
    "GET /api/weather": { price: "0.01", chain: "solana" },
  },
});

// Multi-chain merchant (recommended)
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddresses: {
    solana:  process.env.MERCHANT_ADDRESS_SOLANA!,   // Solana base58
    polygon: process.env.MERCHANT_ADDRESS_POLYGON!,  // EVM 0x-hex
    base:    process.env.MERCHANT_ADDRESS_BASE!,     // EVM 0x-hex
  },
  routes: {
    "POST /api/trade": {
      price: "0.05",
      chains: ["solana", "polygon", "base"],
    },
  },
});
```

**Resolution rule.** For each route × chain combination, the middleware resolves `payTo` in this order:
1. `merchantAddresses[chainShorthand]` (case-insensitive key match)
2. `merchantAddress` (legacy single-string fallback)
3. Throws at middleware construction with a chain-named error.

You can have both fields set: `merchantAddresses` wins for chains in the map, `merchantAddress` covers the rest.

**Format validation is fail-fast.** A Solana base58 address under a `polygon` key (or vice versa) throws at init with a chain-named error message — not at request time, not at settle time.

### Troubleshooting

To check which address PincerPay would actually use for a given chain in your config:

```typescript
import { resolveMerchantAddress } from "@pincerpay/core";

resolveMerchantAddress(config, "polygon"); // "0x..."
resolveMerchantAddress(config, "solana");  // "GjsW..."
```

## Reading the Verified Payer

After successful settlement, the middleware surfaces the verified payer (and the rest of the settlement metadata) on the Hono request context under the `pincerpay` key. Your route handlers can attribute the action to the paying agent without re-decoding the `X-PAYMENT` request header.

```typescript
import { Hono } from "hono";
import {
  createPincerPayMiddleware,
  type PincerPayContextVariables,
} from "@pincerpay/merchant/nextjs";

const app = new Hono<{ Variables: PincerPayContextVariables }>();

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    routes: {
      "POST /api/trade": { price: "0.05", chain: "solana", description: "Place trade" },
    },
  })
);

app.post("/api/trade", async (c) => {
  const { payer, transaction, network } = c.get("pincerpay");
  // payer    -> verified agent wallet (Solana base58 or EVM 0x-hex)
  // transaction -> settlement tx hash
  // network  -> CAIP-2 network id (e.g., "solana:5eykt4...", "eip155:8453")

  await recordTrade({ agentWallet: payer, txHash: transaction });
  return c.json({ ok: true });
});
```

`payer` comes from the facilitator's verified settle response — not the unverified `X-PAYMENT` request header. It is canonical across schemes (EVM `authorization.from`, Solana signer, etc. are all normalized to a single string).

> **Don't re-decode `X-PAYMENT` to extract the payer.** The request header carries an unverified, scheme-specific payload. The middleware already verifies, settles, and surfaces the canonical payer on `c.get("pincerpay")`. If you find yourself probing `payload.authorization.from` / `payload.from` / `payload.signer`, stop — read `c.get("pincerpay").payer` instead.

The same `payer` field is also included in the base64-encoded `payment-response` response header for clients that bypass the middleware and post directly to `/v1/settle`.

## API Reference

### `createPincerPayMiddleware(config): Hono.MiddlewareHandler`

Hono middleware that intercepts requests matching configured routes and returns HTTP 402 with x402 payment requirements. On a successful payment, settles via the PincerPay facilitator and sets `c.set("pincerpay", { payer, transaction, network })` before passing to the next handler. Used directly in Hono apps and inside Next.js App Router via `hono/vercel`.

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
  /** Single-chain receiving wallet (legacy / fallback). At least one of `merchantAddress` or `merchantAddresses` must be set. */
  merchantAddress?: string;
  /** Per-chain receiving wallets. Keys are chain shorthands ("solana", "polygon", "base", "solana-devnet", ...). */
  merchantAddresses?: Record<string, string>;
  facilitatorUrl?: string;          // defaults to https://facilitator.pincerpay.com
  routes: Record<string, RoutePaywallConfig>;
  syncFacilitatorOnStart?: boolean; // defer facilitator sync to first request (default: false)
}

interface RoutePaywallConfig {
  price: string;        // USDC amount (e.g., "0.01")
  chain?: string;       // Chain shorthand (e.g., "solana", "base")
  chains?: string[];    // Multiple chains
  description?: string; // Human-readable description
}

interface PincerPayPaymentInfo {
  payer: string;        // Verified agent wallet (Solana base58 or EVM 0x-hex)
  transaction: string;  // Settlement transaction hash
  network: string;      // CAIP-2 network id
}

type PincerPayContextVariables = {
  pincerpay: PincerPayPaymentInfo;
};
```

### Utility Functions

```typescript
import { toBaseUnits, resolveRouteChains, getUsdcAsset } from "@pincerpay/merchant";

toBaseUnits("0.01");              // "10000" (USDC has 6 decimals)
toBaseUnits("1.00");              // "1000000"

resolveRouteChains(routeConfig);  // ["solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"]

getUsdcAsset("solana-devnet");    // USDC mint address for Solana devnet
getUsdcAsset("base");             // USDC contract address for Base
```

## Common Patterns

### Multi-chain pricing

```typescript
createPincerPayMiddleware({
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
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_ADDRESS",
  routes: {
    "GET /api/premium": { price: "1.00", chain: "solana" },
    // GET /api/free is not listed -- no paywall
  },
});
```

## Webhook Verification

PincerPay signs every webhook delivery with your webhook secret (HMAC-SHA256). Verify the `X-PincerPay-Signature` header to ensure requests are authentic:

```typescript
import crypto from "node:crypto";

function verifyWebhook(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const age = Math.floor(Date.now() / 1000) - Number(parts.t);
  if (age > 300) return false; // Reject replays > 5 min

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${payload}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}
```

Header format: `t=<unix-timestamp>,v1=<hmac-sha256-hex>`

Your webhook secret is in the [dashboard settings](https://www.pincerpay.com/dashboard/settings). See [full docs](https://www.pincerpay.com/docs/testing) for Python examples and Express integration patterns.

## Anti-Patterns

### Don't hardcode API keys

```typescript
// Bad
createPincerPayMiddleware({ apiKey: "pp_live_abc123...", ... });

// Good
createPincerPayMiddleware({ apiKey: process.env.PINCERPAY_API_KEY!, ... });
```

### Don't use the merchant SDK on the agent side

The merchant SDK is for servers accepting payments. Agents should use `@pincerpay/agent` to make payments.

### Don't set price to "0"

A price of "0" will still trigger the 402 flow. If a route should be free, omit it from the `routes` config.

### Don't re-decode `X-PAYMENT` to find the payer

The verified payer is on `c.get("pincerpay").payer` after the middleware settles. Reading it from the request header bypasses verification and forces scheme-specific shape probing — see "Reading the Verified Payer" above.
