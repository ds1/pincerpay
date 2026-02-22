---
title: API Reference
description: Facilitator REST API endpoints for payment verification and settlement.
order: 5
section: Reference
---

The PincerPay Facilitator exposes a REST API for verifying and settling x402 payments. Merchants authenticate with an API key; agents submit signed transactions through the merchant's integration.

Base URL: `https://facilitator.pincerpay.com`

## Authentication

Authenticated endpoints require the `x-pincerpay-api-key` header:

```
x-pincerpay-api-key: pp_live_xxxxxxxxxxxx
```

Create API keys from the [dashboard](https://www.pincerpay.com/dashboard). Keys are SHA-256 hashed before storage — the raw key is shown only once at creation time.

Public endpoints (`/v1/supported`, `/health`, `/metrics`, `/openapi.json`) do not require authentication.

## POST /v1/verify

Verify a signed payment transaction without broadcasting it. Returns whether the payment is valid and the payer address.

### Request

```json
{
  "paymentPayload": {
    // x402 payment payload (varies by scheme — opaque to PincerPay)
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000000",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }
}
```

### Response (200)

```json
{
  "isValid": true,
  "payer": "AgentWalletAddress..."
}
```

### Response (200 — invalid)

```json
{
  "isValid": false,
  "invalidReason": "INSUFFICIENT_AMOUNT",
  "invalidMessage": "Insufficient payment amount: expected 1000000, got 500000"
}
```

### Response (400)

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "invalid_type",
      "path": ["paymentRequirements", "network"],
      "message": "Required"
    }
  ]
}
```

## POST /v1/settle

Verify and broadcast a signed payment transaction on-chain. Records the transaction, auto-registers the agent if new, and dispatches a webhook to the merchant.

### Request

Same schema as `/v1/verify`.

```json
{
  "paymentPayload": { },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000000",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }
}
```

### Response (200)

```json
{
  "success": true,
  "transaction": "5UxK3...abc",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "payer": "AgentWalletAddress..."
}
```

### Response (500)

```json
{
  "success": false,
  "errorReason": "INTERNAL_ERROR",
  "errorMessage": "Settlement failed due to an internal error",
  "transaction": "",
  "network": ""
}
```

Transactions under 1 USDC are classified as **optimistic** — the resource is released after mempool broadcast (~200ms) without waiting for block confirmation.

## POST /v1/settle-direct

Direct on-chain settlement via the Anchor program (Solana only). Unlike `/v1/settle` which uses the x402 flow, this route prepares settlement accounts for client-side signing against the on-chain program.

Only available when the facilitator is configured with `ANCHOR_PROGRAM_ID`.

### Request

```json
{
  "agentAddress": "AgentSolanaWalletAddress...",
  "merchantId": "uuid-of-merchant",
  "amount": "1000000",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
}
```

The `network` field defaults to `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` if omitted. Only Solana networks are supported.

### Response (200)

```json
{
  "success": true,
  "transactionId": "uuid",
  "settlementType": "direct",
  "accounts": {
    "config": "AnchorConfigPDA...",
    "merchantAccount": "MerchantPDA...",
    "merchantUsdcAta": "MerchantWalletAddress...",
    "agent": "AgentSolanaWalletAddress..."
  },
  "amount": "1000000",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
}
```

### Response (400)

```json
{
  "error": "Merchant is not registered on-chain. Use /v1/settle for x402 settlement."
}
```

## GET /v1/status/:txHash

Look up a transaction by its on-chain hash or Solana signature.

### Response (200)

```json
{
  "id": "uuid",
  "chainId": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "txHash": "5UxK3...abc",
  "fromAddress": "AgentWalletAddress...",
  "toAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": "1000000",
  "gasCost": "5000",
  "status": "confirmed",
  "optimistic": false,
  "createdAt": "2026-02-20T12:00:00Z",
  "confirmedAt": "2026-02-20T12:00:05Z"
}
```

Transaction statuses: `pending`, `mempool`, `optimistic`, `confirmed`, `failed`.

### Response (404)

```json
{
  "error": "Transaction not found"
}
```

## GET /v1/supported

Returns the payment schemes and networks registered on this facilitator. No authentication required.

### Response (200)

```json
{
  "kinds": [
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
    },
    {
      "scheme": "exact",
      "network": "eip155:8453"
    }
  ],
  "extensions": [],
  "signers": []
}
```

The response is the native x402 facilitator format from `@x402/core`. Networks use [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) identifiers:

| Network | CAIP-2 ID |
|---------|-----------|
| Solana (mainnet) | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana (devnet) | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Base | `eip155:8453` |
| Base Sepolia | `eip155:84532` |
| Polygon | `eip155:137` |
| Polygon Amoy | `eip155:80002` |

## GET /health

Health check endpoint. No authentication required. Returns service status, database connectivity, and background worker health.

### Response (200)

```json
{
  "status": "ok",
  "service": "pincerpay-facilitator",
  "timestamp": "2026-02-20T12:00:00Z",
  "uptime": 3600,
  "database": "connected",
  "workers": {
    "confirmation": {
      "running": false,
      "lastCycleAt": "2026-02-20T11:59:30Z",
      "cycleCount": 120,
      "consecutiveErrors": 0,
      "lastError": null
    },
    "webhookRetry": { },
    "onChainRecorder": { }
  }
}
```

Returns `503` when the service is shutting down or degraded (database disconnected, worker errors).

## GET /metrics

Real-time metrics snapshot. No authentication required.

### Response (200)

```json
{
  "uptime": 3600,
  "settlements": {
    "total": 42,
    "byChain": { "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": 40, "eip155:8453": 2 },
    "byStatus": { "success": 40, "failure": 2 }
  },
  "verifications": {
    "total": 100,
    "valid": 95,
    "invalid": 5
  },
  "latency": {
    "settle": { "p50": 250, "p95": 800, "p99": 1200, "count": 40 },
    "verify": { "p50": 50, "p95": 150, "p99": 250, "count": 100 }
  },
  "errors": {
    "total": 5,
    "byRoute": { "/v1/settle": 2, "/v1/verify": 3 }
  }
}
```

## GET /openapi.json

OpenAPI 3.1.0 specification for the Facilitator API. No authentication required.

## Rate Limiting

All authenticated endpoints are rate-limited per API key using a sliding window.

| Scope | Limit |
|-------|-------|
| Global (all authenticated routes) | 120 req/min |
| `/v1/settle` | 50 req/min |
| `/v1/settle-direct` | 50 req/min |
| `/v1/verify` | 100 req/min |

Rate limit headers are included on every authenticated response:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1708430400
```

When exceeded, the response includes a `Retry-After` header:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

```json
{
  "error": "Rate limit exceeded"
}
```

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Invalid request (bad schema, wrong chain, missing fields) |
| `401` | Missing or invalid API key |
| `402` | Payment required (returned by merchant middleware, not the facilitator) |
| `404` | Transaction or merchant not found |
| `429` | Rate limit exceeded |
| `500` | Facilitator internal error |
| `503` | Service shutting down (includes `Retry-After: 1` header) |

Validation errors (400) include Zod issue details:

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "invalid_type",
      "path": ["paymentRequirements"],
      "message": "Required"
    }
  ]
}
```

## Webhooks

Merchants can register a webhook URL in the dashboard to receive async notifications when payment status changes.

### Events

| Event | Trigger |
|-------|---------|
| `payment.settled` | Payment broadcast on-chain (from `/v1/settle`) |
| `payment.confirmed` | Payment confirmed on-chain (from confirmation worker) |
| `payment.failed` | Payment failed to confirm within timeout |

### Payload

All webhook events use the same payload structure:

```json
{
  "event": "payment.settled",
  "transaction": {
    "txHash": "5UxK3...abc",
    "chainId": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000000",
    "fromAddress": "AgentWalletAddress...",
    "toAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "status": "optimistic",
    "endpoint": "https://merchant.com/api/weather"
  }
}
```

The `status` field reflects the transaction state at the time of the event: `optimistic`, `confirmed`, or `failed`.

### Delivery

- Webhooks are delivered as `POST` requests with `Content-Type: application/json`
- Timeout: 10 seconds per attempt
- Retries on failure: up to 5 attempts with exponential backoff (1s, 5s, 30s, 2min, 10min)
- Delivery status is tracked in the database (`pending` → `delivered` | `retrying` → `failed`)
