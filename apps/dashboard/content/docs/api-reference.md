---
title: API Reference
description: Facilitator REST API endpoints for payment verification and settlement.
order: 5
section: Reference
---

The PincerPay Facilitator exposes a REST API for verifying and settling x402 payments. Agents interact with the facilitator during the 402 payment flow; merchants verify receipts against it.

Base URL: `https://facilitator.pincerpay.com`

## POST /verify

Verify a signed payment transaction without broadcasting it. Used by agents to validate a payment before committing.

### Request

```json
{
  "x402Version": 1,
  "network": "solana",
  "payload": {
    "signature": "base64-encoded-signed-transaction",
    "resource": "https://merchant.com/api/weather",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "maxAmountRequired": "10000"
  }
}
```

### Response (200)

```json
{
  "valid": true,
  "message": "Payment verified"
}
```

### Response (400)

```json
{
  "valid": false,
  "message": "Insufficient payment amount: expected 10000, got 5000"
}
```

## POST /settle

Verify and broadcast a signed payment transaction on-chain. Returns a receipt the agent includes in subsequent requests.

### Request

Same format as `/verify`.

### Response (200)

```json
{
  "success": true,
  "network": "solana",
  "txHash": "5UxK3...abc",
  "receipt": "base64-encoded-receipt-token",
  "settledAt": "2026-02-20T12:00:00Z"
}
```

### Response (400)

```json
{
  "success": false,
  "message": "Transaction simulation failed: insufficient USDC balance"
}
```

## GET /supported

Returns the chains, tokens, and payment schemes supported by this facilitator.

### Response (200)

```json
{
  "x402Version": 1,
  "chains": [
    {
      "network": "solana",
      "tokens": ["USDC"],
      "schemes": ["exact"]
    },
    {
      "network": "base",
      "tokens": ["USDC"],
      "schemes": ["exact"]
    },
    {
      "network": "polygon",
      "tokens": ["USDC"],
      "schemes": ["exact"]
    }
  ]
}
```

## Authentication

API requests from registered merchants require an API key:

```
Authorization: Bearer pp_live_xxxxxxxxxxxx
```

Agent-facing endpoints (`/verify`, `/settle`, `/supported`) do not require authentication — agents interact directly with the facilitator using signed transactions as proof of authorization.

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Invalid request (bad signature, insufficient amount, wrong chain) |
| `402` | Payment required (returned by merchant, not facilitator) |
| `404` | Unknown endpoint |
| `429` | Rate limited |
| `500` | Facilitator internal error |

## Webhooks

Merchants can register webhook URLs in the dashboard to receive async notifications.

### Events

| Event | Description |
|-------|-------------|
| `payment.received` | A payment was submitted and is pending confirmation |
| `payment.confirmed` | A payment was confirmed on-chain |
| `payment.failed` | A payment failed to confirm within the timeout |

### Payload

```json
{
  "event": "payment.confirmed",
  "timestamp": "2026-02-20T12:00:05Z",
  "data": {
    "transactionId": "tx_abc123",
    "network": "solana",
    "txHash": "5UxK3...abc",
    "amount": "10000",
    "token": "USDC",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "payFrom": "AgentWalletAddress...",
    "resource": "https://merchant.com/api/weather"
  }
}
```

### Verification

Webhooks include an `X-PincerPay-Signature` header. Verify using your webhook secret from the dashboard:

```typescript
import { verifyWebhook } from "@pincerpay/merchant";

app.post("/webhooks/pincerpay", (req, res) => {
  const valid = verifyWebhook(
    req.body,
    req.headers["x-pincerpay-signature"] as string,
    process.env.PINCERPAY_WEBHOOK_SECRET!,
  );

  if (!valid) return res.status(401).json({ error: "Invalid signature" });

  const { event, data } = req.body;
  // Handle event...
  res.json({ received: true });
});
```
