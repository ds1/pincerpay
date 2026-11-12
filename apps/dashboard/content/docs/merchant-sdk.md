---
title: Merchant SDK
description: Accept USDC payments from AI agents with Hono middleware. Runs in Hono apps and inside Next.js App Router via hono/vercel.
order: 2
section: SDKs
---

The `@pincerpay/merchant` package provides Hono middleware that handles the full x402 payment flow: returning 402 challenges, verifying payment proofs, and confirming settlement. It runs natively in Hono apps and inside Next.js App Router via `hono/vercel`. An Express adapter is on the roadmap.

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

Solana addresses (32-byte base58) and EVM addresses (20-byte hex) are categorically different formats, and a single string can't hold both. Use `merchantAddresses` to bind one wallet per chain:

```typescript
// Single-chain merchant (legacy, still supported)
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

**Format validation is fail-fast.** A Solana base58 address under a `polygon` key (or vice versa) throws at init with a chain-named error like `Route "POST /api/trade" targets chain "polygon": address "GjsW..." is not a valid EVM address.` It fails at init, not at request time, not at settle time.

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

`payer` comes from the facilitator's verified settle response, not the unverified `X-PAYMENT` request header. It is canonical across schemes (EVM `authorization.from`, Solana signer, etc. are all normalized to a single string).

> **Don't re-decode `X-PAYMENT` to extract the payer.** The request header carries an unverified, scheme-specific payload. The middleware already verifies, settles, and surfaces the canonical payer on `c.get("pincerpay")`. If you find yourself probing `payload.authorization.from` / `payload.from` / `payload.signer`, stop and read `c.get("pincerpay").payer` instead.

The same `payer` field is also included in the base64-encoded `payment-response` response header for clients that bypass the middleware.

The middleware sets **exactly one** context variable, `pincerpay` (typed as `PincerPayPaymentInfo`). There is no `agentWallet` context key: in the example above, `agentWallet` is just a field name on the caller's own `recordTrade(...)` function. Import `PincerPayContextVariables` / `PincerPayPaymentInfo` from `@pincerpay/merchant` (or `@pincerpay/merchant/nextjs`) instead of duck-typing the shape, so you fail at compile time if the contract changes. Any change to the keys set, or to `PincerPayPaymentInfo`, is called out in the merchant package CHANGELOG.

## Selling a Resource That Is Not an HTTP Route

The middleware paywalls HTTP routes. A merchant that sells a credit grant, a job, or a download link quotes and settles from its own server code. The flow has three steps: quote, settle, and grant.

### 1. Quote

Build the requirement on your server and store it with the quote. On Solana the facilitator pays the network fee. The quote therefore needs the facilitator's `feePayer` from `GET /v1/supported`. Fetch it once and cache it.

```typescript
import {
  PincerPayClient,
  buildPaymentRequirements,
  buildPaymentRequired,
} from "@pincerpay/merchant";

const client = new PincerPayClient({ apiKey: process.env.PINCERPAY_API_KEY! });
const supported = await client.getSupported();

const requirements = buildPaymentRequirements({
  chain: "solana-devnet",                        // required, there is no mainnet default
  payTo: process.env.PINCERPAY_MERCHANT_WALLET!, // must equal your registered wallet
  price: "20",                                   // or amount: "20000000"
  supported,
});
await db.quotes.insert({ id: quoteId, requirements });

// Send this to the agent over MCP, JSON, or any other channel.
const paymentRequired = buildPaymentRequired({
  accepts: [requirements],
  resource: { url: `https://example.com/quotes/${quoteId}`, description: "500 credits" },
});
```

A requirement carries these fields.

| Field | Value |
|-------|-------|
| `scheme` | `"exact"` |
| `network` | CAIP-2 id, for example `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| `asset` | The chain's USDC mint or contract |
| `amount` | USDC base units as a string |
| `payTo` | Your registered wallet for that chain |
| `maxTimeoutSeconds` | Seconds the agent has to pay. Default 300. |
| `extra` | On Solana, the facilitator's `feePayer`. On EVM, the USDC EIP-712 `name` and `version`. |

`payTo` must equal the wallet registered on your merchant account byte for byte. The facilitator answers any other address with `403 pay_to_not_merchant_wallet`. A `pp_test_` key works only on test networks. A mainnet requirement sent with a test key gets `403 test_key_chain_forbidden`.

### 2. Settle

The agent signs the challenge and sends back a payment payload. Match it against your stored quote and settle against your copy. Never settle against the requirement the agent sent.

```typescript
import { PincerPayError, matchOfferedRequirement } from "@pincerpay/merchant";

const quote = await db.quotes.get(quoteId);
const offered = matchOfferedRequirement([quote.requirements], paymentPayload.accepted);
if (!offered) throw new Error("The payment does not match the quote.");

try {
  const settled = await client.settle(paymentPayload, offered);
  if (!settled.success) {
    // Refused on chain or by verification. settled.errorReason says why.
  }
} catch (err) {
  if (err instanceof PincerPayError && err.code === "pay_to_not_merchant_wallet") {
    // Your payTo drifted from the registered wallet.
  }
  throw err;
}
```

`settle` verifies the payment before it broadcasts. `client.verify(paymentPayload, offered)` runs the same check and moves no funds. A 200 with `isValid: false` is a normal answer and does not throw.

### 3. Grant exactly once

Key the grant on `settled.network` plus `settled.transaction`. Refuse a second grant for the same pair. A replayed payload can settle twice.

Two signals confirm a payment after the settle response.

- The `payment.settled` webhook fires once per successful settle. See [Webhook Verification](#webhook-verification).
- `client.getStatus(txHash)` reads the facilitator's transaction row.

The facilitator writes that row after it answers `/v1/settle`. A 404 from `getStatus` right after a successful settle means the row is not written yet. Retry with backoff for about 30 seconds. A settle that crashed after broadcast is never recorded. A 404 therefore never proves the payment did not happen. Check the chain before you refuse a buyer.

`payment.confirmed` fires only for payments under 1 USDC. The facilitator records larger payments as `confirmed` at settle time. For them `payment.settled` is the last event.

### The cut

`feeBps` adds PincerPay's cut on top of the listed price. The formula is `amount = ceil(base * (10000 + feeBps) / 10000)`. A nonzero cut is also written to `extra.feeBps`. The agent can then show the buyer what the cut adds. Store the builder's `amount` on the quote and never compute it yourself.

```typescript
buildPaymentRequirements({ chain: "solana-devnet", payTo, price: "20", supported, feeBps: 100 });
// amount "20200000", extra { feePayer: "...", feeBps: 100 }
```

The middleware takes the same `feeBps` in its config. Unset means 0. At 0 every 402 stays exactly as before.

### Client Errors and Timeouts

`PincerPayClient` takes `apiKey`, `facilitatorUrl`, and `timeoutMs`. It needs no `routes`. A trailing `/v1` on `facilitatorUrl` is stripped. Each request times out after 60 seconds by default.

Every non-2xx response throws `PincerPayError` with `status`, `code`, `body`, `path`, and `retryAfter`. `code` comes from the body's `error`, `errorReason`, or `invalidReason`. A timeout throws status 0 with code `timeout`. A network failure throws status 0 with code `network_error`. The builders throw `PincerPayError` with status 0 and codes such as `missing_fee_payer` and `invalid_pay_to`. The [package README](https://github.com/ds1/pincerpay/tree/master/packages/merchant#api-reference) lists every export and code.

## Configuration

`createPincerPayMiddleware()` accepts a `PincerPayMiddlewareConfig` object. It is `PincerPayConfig` plus an optional `feeBps`.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your PincerPay API key (`pp_live_...`) |
| `merchantAddress` | `string` | If `merchantAddresses` not set | Single-chain receiving wallet (legacy / fallback) |
| `merchantAddresses` | `Record<string, string>` | If `merchantAddress` not set | Per-chain receiving wallets keyed by chain shorthand (`solana`, `polygon`, `base`, ...) |
| `facilitatorUrl` | `string` | No | Override facilitator URL (default: `https://facilitator.pincerpay.com`) |
| `routes` | `Record<string, RoutePaywallConfig>` | Yes | Map of endpoint patterns to paywall config |
| `syncFacilitatorOnStart` | `boolean` | No | Defer facilitator sync to first request (default: `false`) |
| `feeBps` | `number` | No | PincerPay's cut in basis points, added on top of each route price (default: `0`) |

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

> **CI / build-time tip.** If your build evaluates the middleware (e.g., `next build` running route module top-level code) without env vars set, `process.env.MERCHANT_ADDRESS!` resolves to `undefined` and now fails fast at middleware init. Either gate construction on env presence, or fall back to a placeholder Solana address (`"11111111111111111111111111111111"`, the System Program: valid base58, can't receive funds).

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
