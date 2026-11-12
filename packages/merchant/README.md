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

Express adapter is on the roadmap. Use Hono today, since it runs anywhere Express does and is a drop-in for most paywall workloads. Track [the Express adapter issue](https://github.com/ds1/pincerpay/issues) for the upcoming release.

## Multi-chain Receiving Wallets

> **How routing works:** Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. **No cross-chain conversion happens.** If you accept Solana and Polygon and an agent pays on Polygon, USDC arrives in your Polygon wallet.

Solana and EVM addresses are categorically different formats, so a single string can't hold both. Use `merchantAddresses` to bind one wallet per chain:

```typescript
// Single-chain merchant (legacy, still supported)
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

**Format validation is fail-fast.** A Solana base58 address under a `polygon` key (or vice versa) throws at init with a chain-named error message, not at request time, not at settle time.

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

`payer` comes from the facilitator's verified settle response, not the unverified `X-PAYMENT` request header. It is canonical across schemes (EVM `authorization.from`, Solana signer, etc. are all normalized to a single string).

> **Don't re-decode `X-PAYMENT` to extract the payer.** The request header carries an unverified, scheme-specific payload. The middleware already verifies, settles, and surfaces the canonical payer on `c.get("pincerpay")`. If you find yourself probing `payload.authorization.from` / `payload.from` / `payload.signer`, stop and read `c.get("pincerpay").payer` instead.

The same `payer` field is also included in the base64-encoded `payment-response` response header for clients that bypass the middleware and post directly to `/v1/settle`.

### Context contract

The middleware sets **exactly one** Hono context variable: `pincerpay`, typed as
`PincerPayPaymentInfo`. There is no `agentWallet` (or any other) context key - in
the example above, `agentWallet` is just a field name on the caller's own
`recordTrade(...)` function. Import the canonical type instead of duck-typing the
shape, and you will fail at compile time if it ever changes:

```typescript
import type {
  PincerPayContextVariables, // { pincerpay: PincerPayPaymentInfo }
  PincerPayPaymentInfo,      // { payer: string; transaction: string; network: string }
} from "@pincerpay/merchant"; // also re-exported from "@pincerpay/merchant/nextjs"
```

Any change to the keys the middleware sets, or to `PincerPayPaymentInfo`, will be
called out in this package's [CHANGELOG](./CHANGELOG.md).

## Selling a resource that is not an HTTP route

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

## API Reference

### `createPincerPayMiddleware(config): Hono.MiddlewareHandler`

Hono middleware that intercepts requests matching configured routes and returns HTTP 402 with x402 payment requirements. On a successful payment, settles via the PincerPay facilitator and sets `c.set("pincerpay", { payer, transaction, network })` before passing to the next handler. Used directly in Hono apps and inside Next.js App Router via `hono/vercel`.

### `PincerPayClient`

Typed client for the facilitator HTTP API. A full `PincerPayConfig` also fits the constructor.

```typescript
import { PincerPayClient } from "@pincerpay/merchant";

const client = new PincerPayClient({
  apiKey: process.env.PINCERPAY_API_KEY!,
  facilitatorUrl: "https://facilitator.pincerpay.com", // default; a trailing /v1 is stripped
  timeoutMs: 60_000,                                   // default
});

const supported: SupportedResponse = await client.getSupported();
const check: VerifyResponse = await client.verify(paymentPayload, paymentRequirements);
const settled: SettleResponse = await client.settle(paymentPayload, paymentRequirements);
const status: TransactionStatus = await client.getStatus(txHash); // the hash is URL-encoded
```

Every non-2xx response throws `PincerPayError`. A timeout throws `PincerPayError` with status 0 and code `timeout`. A network failure throws status 0 and code `network_error`.

`getStatus` throws a 404 when the facilitator has no row for the hash. Right after a successful settle that means the row is not written yet. Retry with backoff for about 30 seconds. A settle that crashed after broadcast is never recorded. A 404 therefore never proves the payment did not happen.

### `buildPaymentRequirements(options): PaymentRequirements`

Builds one `exact` requirement for a server-side quote. See [Selling a resource that is not an HTTP route](#selling-a-resource-that-is-not-an-http-route).

```typescript
buildPaymentRequirements({
  chain: string;                          // shorthand or CAIP-2 id, required
  payTo: string;                          // validated for the chain
  price: string;                          // USDC with at most 6 decimals. Pass price or amount.
  amount: string;                         // USDC base units
  supported?: { kinds: SupportedKind[] }; // required on Solana for feePayer
  extra?: Record<string, unknown>;        // merged over the namespace defaults
  maxTimeoutSeconds?: number;             // default 300
  feeBps?: number;                        // 0 to 10000, default 0
}): PaymentRequirements;
```

`extra` merges in this order: the namespace defaults, then yours, then the facilitator's kind extra. The last one wins. The builder throws `PincerPayError` with status 0 and one of these codes: `unknown_chain`, `invalid_pay_to`, `invalid_price`, `invalid_amount`, `invalid_fee_bps`, `invalid_max_timeout`, `missing_fee_payer`. On Solana it never falls back to `payTo` as the fee payer.

### `buildPaymentRequired(options): PaymentRequired`

Wraps requirements in an x402 version 2 challenge body with `resource.url`.

```typescript
buildPaymentRequired({
  accepts: PaymentRequirements[]; // at least one
  resource: { url: string; description?: string; mimeType?: string };
  error?: string;
  extensions?: Record<string, unknown>;
}): PaymentRequired;
```

### `matchOfferedRequirement(offered, accepted): T | undefined`

Returns the offered requirement that matches the agent's accepted one on scheme, network, amount, asset, and payTo. EVM addresses compare case-insensitively. Solana addresses compare exactly. Settle against the returned offer.

### `PincerPayError`

```typescript
class PincerPayError extends Error {
  status: number;      // HTTP status, or 0 with no response
  code?: string;       // body.error, body.errorReason, or body.invalidReason
  body: unknown;       // parsed JSON, or the raw text
  path: string;        // for example "/v1/settle"
  retryAfter?: number; // seconds, from a Retry-After header
}
```

The message keeps the format `Facilitator <path> failed (<status>): <body text>`.

### Types

`PaymentRequirements`, `PaymentRequired`, `ResourceInfo`, `SupportedKind`, `SupportedResponse`, `VerifyResponse`, `SettleResponse`, and `Network` are structural copies of the `@x402/core` 2.6 types. `TransactionStatus` is the body of `GET /v1/status/:txHash`.

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

// The middleware takes PincerPayConfig plus an optional cut.
type PincerPayMiddlewareConfig = PincerPayConfig & {
  feeBps?: number;                  // basis points added on top of each price (default: 0)
};

// PincerPayClient needs no routes.
interface PincerPayClientConfig {
  apiKey: string;
  facilitatorUrl?: string;          // a trailing /v1 is stripped
  timeoutMs?: number;               // default 60000
  merchantAddress?: string;
  merchantAddresses?: Record<string, string>;
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

The verified payer is on `c.get("pincerpay").payer` after the middleware settles. Reading it from the request header bypasses verification and forces scheme-specific shape probing. See "Reading the Verified Payer" above.
