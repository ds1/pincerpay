---
title: "Merchant SDK Functions"
description: "Implementation guide to @pincerpay/merchant - the Next.js paywall middleware, the low-level facilitator client, and the amount/chain helpers."
order: 3.8
section: SDK Guides
---

`@pincerpay/merchant` is how a merchant accepts agent payments: wrap your routes in middleware that returns `402` until a valid USDC payment arrives, then let the request through. The package has two entry points and five exports. This guide covers each, including the startup-time validation that will throw before your server ever serves a request.

> **ESM-only, server-side.** Two entry points: `@pincerpay/merchant` (helpers + client) and `@pincerpay/merchant/nextjs` (the middleware). There is **no Express or Hono adapter** - those were removed; the Next.js middleware is hono-compatible and is the supported path.

## `createPincerPayMiddleware(config)` - the paywall

```ts
import { Hono } from "hono";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();
app.use("*", createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddresses: { solana: process.env.MERCHANT_ADDRESS_SOLANA! },
  routes: {
    "GET /api/research/:id": { price: "0.05", chain: "solana" },
    "POST /api/summarize":   { price: "0.25", chains: ["solana", "base"] },
  },
}));
```

It returns an async hono-style middleware `(c, next) => ...`. The `config` is a `PincerPayConfig` (imported from `@pincerpay/core` if you want the type):

| Field | Required | Notes |
|---|---|---|
| `apiKey` | ✅ | Sent as the `x-pincerpay-api-key` header to the facilitator |
| `routes` | ✅ | Keyed by `"METHOD /path"`, e.g. `"GET /api/weather"` → `RoutePaywallConfig` |
| `merchantAddress` | - | Legacy single receive wallet / fallback |
| `merchantAddresses` | - | Per-chain wallets, keyed by chain shorthand (case-insensitive), wins over `merchantAddress` |
| `facilitatorUrl` | - | Defaults to production; a trailing `/v1` is stripped automatically |
| `syncFacilitatorOnStart` | - | **Currently a no-op** - declared in the type but not read; the middleware always fetches `/v1/supported` at init regardless |

One of `merchantAddress` / `merchantAddresses` must be present. Each `RoutePaywallConfig` has a `price` (a **human USDC decimal string** like `"0.01"` - the middleware converts it to base units for you), plus `chain?`, `chains?`, and `description?`. **If you specify neither `chain` nor `chains`, the route defaults to `["solana"]`.**

### It validates eagerly - at `createPincerPayMiddleware()` time

Before serving anything, for every route × chain the middleware calls `resolveChain`, `resolveMerchantAddress`, and `validateMerchantAddressForChain`. Any of these throws synchronously, so a misconfiguration fails fast at boot:

- `Unknown chain: <x>` - a route names a chain that isn't recognized.
- a missing-address throw - you paywalled a chain you have no wallet for.
- a format throw - a configured address fails the Solana base58 / EVM `0x`+40hex check.

This is a feature: you learn about a broken config at deploy, not when an agent gets a 500.

### The request lifecycle

- Path/method **doesn't match** a route → `next()` (free passthrough).
- Matches, **no payment header** (`payment-signature` or `x-payment`) → **HTTP 402** with a JSON body (`x402Version`, `error`, `resource`, `accepts`, `extensions`) and a base64 `payment-required` header describing accepted assets.
- Matches **with a payment header** → the middleware POSTs to the facilitator's `/v1/settle`. On `success: false` it returns **402** `{ error: "Payment settlement failed", reason, message }`. On success it sets `c.set("pincerpay", paymentInfo)`, adds a base64 `payment-response` header, and calls `next()`.
- An unexpected error → **HTTP 500** `{ error: "Payment processing failed", detail }`.

After payment, read the verified result in your handler:

```ts
import type { PincerPayContextVariables } from "@pincerpay/merchant/nextjs";

const app = new Hono<{ Variables: PincerPayContextVariables }>();
app.get("/api/research/:id", (c) => {
  const { payer, transaction, network } = c.get("pincerpay"); // PincerPayPaymentInfo
  // `payer` is the verified payer from the facilitator's settle response - not the raw request header.
  return c.json({ data: "..." });
});
```

`PincerPayPaymentInfo` is `{ payer: string; transaction: string; network: string }` (`network` is the CAIP-2 ID). It and `PincerPayContextVariables` are re-exported from `@pincerpay/merchant/nextjs`.

## `PincerPayClient` - the low-level facilitator client

When you want to drive the facilitator directly (custom frameworks, server-to-server verification) instead of using the middleware:

```ts
import { PincerPayClient } from "@pincerpay/merchant";

const client = new PincerPayClient({ apiKey, merchantAddresses });
await client.verify(paymentPayload, paymentRequirements); // POST /v1/verify
await client.settle(paymentPayload, paymentRequirements); // POST /v1/settle
await client.getSupported();                              // GET  /v1/supported
await client.getStatus(txHash);                           // GET  /v1/status/:txHash
```

The constructor takes a `PincerPayConfig` and exposes readonly `facilitatorUrl`, `apiKey`, `merchantAddress?`, `merchantAddresses?`. Every method sends the API-key header and returns the parsed JSON as `unknown` (you cast/validate). On any non-2xx response they **throw** `Error("Facilitator <path> failed (<status>): <body>")`, so wrap calls in try/catch. Note one asymmetry: the client does **not** strip a trailing `/v1` from `facilitatorUrl` the way the middleware does - pass the bare origin.

## Amount & chain helpers

```ts
import { toBaseUnits, resolveRouteChains, getUsdcAsset } from "@pincerpay/merchant";

toBaseUnits("0.01");              // → "10000"  (human USDC → 6-decimal base units; truncates extra decimals; non-numeric throws)
resolveRouteChains(routeConfig);  // → CAIP-2 IDs for the route; defaults to ["solana"] when unset
getUsdcAsset("polygon");          // → the USDC contract address for that chain; throws "Unknown chain: <x>" if unresolved
```

`toBaseUnits` is the conversion the middleware applies to `price` for you - reach for it when you mint your own paywall payloads.

## Where next

The middleware leans entirely on [`@pincerpay/core`](/docs/guide-core) for chain/address resolution, so its startup throws are really core's validators talking. For the conceptual end-to-end flow, see the [Merchant SDK overview](/docs/merchant-sdk) and [Quickstart: Merchant](/docs/quickstart-merchant).
