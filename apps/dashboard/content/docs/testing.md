---
title: Testing
description: Set up devnet/testnet environments for local development and testing.
order: 6
section: Reference
---

PincerPay supports devnet and testnet chains for development. Use these to test the full payment flow without spending real USDC.

> **Zero-setup option:** The [interactive demo](https://demo.pincerpay.com/playground) simulates the full payment flow in your browser with no wallet, tokens, or environment setup required.

## Devnet Configuration

### Merchant

Point your paywall at a devnet chain:

```typescript
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_DEVNET_WALLET",
  routes: {
    "GET /api/weather": {
      price: "0.01",
      chain: "solana-devnet",
      description: "Weather data",
    },
  },
})
```

### Agent

Match the merchant's chain:

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});
```

## Getting Test USDC

| Chain | Faucet |
|-------|--------|
| Solana Devnet | [Circle faucet](https://faucet.circle.com) — select Solana, USDC |
| Base Sepolia | [Coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) |
| Polygon Amoy | [Polygon faucet](https://faucet.polygon.technology/) |

## Verifying Transactions

After running a test payment:

1. **Dashboard** — check the Transactions page for status (`pending` → `confirmed`)
2. **Solana Explorer** — paste the tx hash at [explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet)
3. **Base Sepolia Explorer** — paste the tx hash at [sepolia.basescan.org](https://sepolia.basescan.org)

## End-to-End Test Script

A complete test from agent to merchant:

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";
import { PincerPayAgent } from "@pincerpay/agent";

// 1. Start merchant
const app = new Hono();
app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_WALLET!,
    routes: {
      "GET /api/data": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Test data",
      },
    },
  })
);
app.get("/api/data", (c) => c.json({ result: "success" }));

const server = serve({ fetch: app.fetch, port: 4000 });

// 2. Create agent and pay
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

const res = await agent.fetch("http://localhost:4000/api/data");
console.log(await res.json()); // { result: "success" }

server.close();
```

## Webhook Testing

Test webhook delivery to confirm your integration receives payment events correctly.

1. **Set up a webhook URL.** For local development, use a tunnel service like [ngrok](https://ngrok.com) (`ngrok http 4000`) or a hosted listener like [webhook.site](https://webhook.site) to get a publicly reachable URL.
2. **Configure the webhook URL** in the PincerPay dashboard under Settings > Webhooks. Copy the webhook secret displayed after saving.
3. **Make a test payment** using the devnet flow described above. The facilitator fires a `payment.completed` event to your webhook URL on settlement.
4. **Check delivery status** by calling `GET /v1/webhooks`. Each entry shows the HTTP status code returned by your endpoint and the timestamp of the attempt.
5. **Retry failed webhooks** by calling `POST /v1/webhooks/:id/retry`. This re-sends the same payload with a fresh signature.

### Verifying Webhook Signatures

Every webhook request includes an `X-PincerPay-Signature` header with the format:

```
t=<timestamp>,v1=<hmac-hex>
```

To verify the signature:

1. Parse the `t` (Unix timestamp) and `v1` (HMAC hex digest) values from the header.
2. Reconstruct the signed content by concatenating `<timestamp>.<raw-body>`.
3. Compute an HMAC-SHA256 using the webhook secret from the dashboard as the key.
4. Compare the computed digest to `v1` using a timing-safe comparison.
5. Optionally, validate that the timestamp is within an acceptable tolerance (e.g., 5 minutes) to prevent replay attacks.

**Node.js**

```typescript
import crypto from "node:crypto";

function verifyWebhookSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Replay protection
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (age > toleranceSec) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**Python**

```python
import hmac, hashlib, time

def verify_webhook(payload: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    ts, sig = parts.get("t"), parts.get("v1")
    if not ts or not sig:
        return False
    if time.time() - int(ts) > tolerance:
        return False
    expected = hmac.new(
        secret.encode(), f"{ts}.{payload.decode()}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected)
```

## Common Error Scenarios

| Error | Cause | Fix |
|-------|-------|-----|
| **402 with no payment** | Agent did not include the `x-payment` header. | Verify the agent is configured for the same chain as the merchant (e.g., both on `solana-devnet`). |
| **403 spending limit** | Agent exceeded the per-transaction or daily spending limit. | Adjust the agent's spending policies in the dashboard. |
| **500 on settlement** | Usually an RPC node error or network timeout. | Check the facilitator health endpoint (`GET /health`) and review facilitator logs for RPC connection issues. |

## Rate Limit Testing

The facilitator enforces per-IP rate limits. Default thresholds:

| Endpoint | Limit |
|----------|-------|
| Global | 120 req/min |
| Settle | 50 req/min |
| Verify | 100 req/min |

Rate limit state is communicated via response headers:

- `X-RateLimit-Limit` -- the maximum number of requests allowed in the window.
- `X-RateLimit-Remaining` -- how many requests remain before throttling.
- `X-RateLimit-Reset` -- Unix timestamp when the window resets.

When the limit is exceeded, the facilitator returns **429 Too Many Requests** with a `Retry-After` header indicating how many seconds to wait before retrying.
