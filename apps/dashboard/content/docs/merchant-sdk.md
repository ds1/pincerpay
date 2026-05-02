---
title: Merchant SDK
description: Accept USDC payments from AI agents with Hono middleware. Runs in Hono apps and inside Next.js App Router via hono/vercel.
order: 2
section: SDKs
---

The `@pincerpay/merchant` package provides Hono middleware that handles the full x402 payment flow — returning 402 challenges, verifying payment proofs, and confirming settlement. It runs natively in Hono apps and inside Next.js App Router via `hono/vercel`. An Express adapter is on the roadmap.

## Installation

```bash
npm install @pincerpay/merchant hono
```

## Hono

```typescript
import { Hono } from "hono";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();

app.use(
  "*",
  createPincerPayMiddleware({
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

app.get("/api/weather", (c) => c.json({ temp: 72, condition: "sunny" }));

export default app;
```

## Next.js (App Router)

Use Hono as a lightweight handler inside a catch-all App Router route:

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
      "GET /api/weather": { price: "0.01", chain: "solana", description: "Weather data" },
    },
  })
);

app.get("/weather", (c) => c.json({ temp: 72 }));

export const GET = handle(app);
export const POST = handle(app);
```

> `basePath("/api")` must match the catch-all route location. Route handlers use paths relative to basePath (`/weather` serves `/api/weather`).

## Multi-chain Receiving Wallets

> **How routing works:** Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. **No cross-chain conversion happens.** If you accept Solana and Polygon and an agent pays on Polygon, USDC arrives in your Polygon wallet.

Solana addresses (32-byte base58) and EVM addresses (20-byte hex) are categorically different formats — a single string can't hold both. Use `merchantAddresses` to bind one wallet per chain:

```typescript
// Single-chain merchant (legacy — still supported)
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm",
  routes: { "GET /api/weather": { price: "0.01", chain: "solana" } },
});

// Multi-chain merchant (recommended)
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddresses: {
    solana:  process.env.MERCHANT_ADDRESS_SOLANA!,
    polygon: process.env.MERCHANT_ADDRESS_POLYGON!,
    base:    process.env.MERCHANT_ADDRESS_BASE!,
  },
  routes: {
    "POST /api/trade": { price: "0.05", chains: ["solana", "polygon", "base"] },
  },
});
```

**Resolution rule.** For each route × chain combination, the middleware resolves `payTo` in this order:
1. `merchantAddresses[chainShorthand]` (case-insensitive key match)
2. `merchantAddress` (legacy single-string fallback)
3. Throws at middleware construction with a chain-named error.

Both fields can coexist: `merchantAddresses` wins for chains in the map, `merchantAddress` covers the rest.

**Format validation is fail-fast.** A Solana base58 address under a `polygon` key (or vice versa) throws at init with a chain-named error like `Route "POST /api/trade" targets chain "polygon": address "GjsW..." is not a valid EVM address.` — not at request time, not at settle time.

To check which address PincerPay would actually use for a given chain in your config:

```typescript
import { resolveMerchantAddress } from "@pincerpay/core";

resolveMerchantAddress(config, "polygon"); // "0x..."
resolveMerchantAddress(config, "solana");  // "GjsW..."
```

## Reading the Verified Payer

After successful settlement, the middleware exposes the verified payer (and the rest of the settlement metadata) on the Hono request context under the `pincerpay` key:

```typescript
import { Hono } from "hono";
import { createPincerPayMiddleware, type PincerPayContextVariables } from "@pincerpay/merchant/nextjs";

const app = new Hono<{ Variables: PincerPayContextVariables }>();
app.use("*", createPincerPayMiddleware({ /* ... */ }));

app.post("/api/trade", async (c) => {
  const { payer, transaction, network } = c.get("pincerpay");
  await recordTrade({ agentWallet: payer, txHash: transaction });
  return c.json({ ok: true });
});
```

`payer` comes from the facilitator's verified settle response — not the unverified `X-PAYMENT` request header. It is canonical across schemes (EVM `authorization.from`, Solana signer, etc. are all normalized to a single string).

> **Don't re-decode `X-PAYMENT` to extract the payer.** The request header carries an unverified, scheme-specific payload. The middleware already verifies, settles, and surfaces the canonical payer on `c.get("pincerpay")`. If you find yourself probing `payload.authorization.from` / `payload.from` / `payload.signer`, stop — read `c.get("pincerpay").payer` instead.

The same `payer` field is also included in the base64-encoded `payment-response` response header for clients that bypass the middleware.

## Configuration

`createPincerPayMiddleware()` accepts a `PincerPayConfig` object:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your PincerPay API key (`pp_live_...`) |
| `merchantAddress` | `string` | If `merchantAddresses` not set | Single-chain receiving wallet (legacy / fallback) |
| `merchantAddresses` | `Record<string, string>` | If `merchantAddress` not set | Per-chain receiving wallets keyed by chain shorthand (`solana`, `polygon`, `base`, ...) |
| `facilitatorUrl` | `string` | No | Override facilitator URL (default: `https://facilitator.pincerpay.com`) |
| `routes` | `Record<string, RoutePaywallConfig>` | Yes | Map of endpoint patterns to paywall config |
| `syncFacilitatorOnStart` | `boolean` | No | Defer facilitator sync to first request (default: `false`) |

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
| `MERCHANT_ADDRESS` | Single-chain merchants | Your wallet address (any chain). For multi-chain, use the per-chain vars below. |
| `MERCHANT_ADDRESS_SOLANA` | Multi-chain (Solana) | Solana base58 receiving wallet |
| `MERCHANT_ADDRESS_POLYGON` | Multi-chain (Polygon) | Polygon EVM receiving wallet (`0x...`) |
| `MERCHANT_ADDRESS_BASE` | Multi-chain (Base) | Base EVM receiving wallet (`0x...`) |

> **CI / build-time tip.** If your build evaluates the middleware (e.g., `next build` running route module top-level code) without env vars set, `process.env.MERCHANT_ADDRESS!` resolves to `undefined` and now fails fast at middleware init. Either gate construction on env presence, or fall back to a placeholder Solana address (`"11111111111111111111111111111111"` — System Program, valid base58, can't receive funds).

## Webhook Verification

When you configure a webhook URL in the dashboard, PincerPay signs every webhook delivery with your webhook secret using HMAC-SHA256. Verify the signature to ensure requests are authentic.

```typescript
import crypto from "node:crypto";
import express from "express";

const WEBHOOK_SECRET = process.env.PINCERPAY_WEBHOOK_SECRET!;

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-pincerpay-signature"] as string;
  if (!signature) return res.status(401).send("Missing signature");

  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=") as [string, string])
  );

  const signedContent = `${parts.t}.${req.body.toString()}`;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedContent)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected))) {
    return res.status(401).send("Invalid signature");
  }

  // Signature valid - process the event
  const event = JSON.parse(req.body.toString());
  console.log(event.event, event.transaction.txHash);
  res.sendStatus(200);
});
```

Your webhook secret is available in the [dashboard settings](https://www.pincerpay.com/dashboard/settings). See the [Testing guide](/docs/testing) for more verification examples.

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
