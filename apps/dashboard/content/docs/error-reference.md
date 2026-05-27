---
title: Error Reference
description: Comprehensive guide to PincerPay facilitator error codes, retry strategies, rate limiting, and common troubleshooting scenarios.
order: 8
section: Reference
---

Every error response from the PincerPay facilitator includes a JSON body with an `error` field describing what went wrong. Some errors include additional structured fields like `code`, `details`, or contextual data. This guide covers every error the facilitator can return, how to handle each one, and how to debug common integration issues.

## Error Code Reference

| HTTP Status | Code | Meaning | Retryable |
|-------------|------|---------|-----------|
| `400` | -- | Invalid request body, unsupported chain, or missing required fields | No |
| `401` | -- | Missing or invalid `x-pincerpay-api-key` header | No |
| `402` | -- | Payment required (returned by merchant middleware, not the facilitator) | Yes (with payment) |
| `403` | `AGENT_REVOKED` | Agent access has been revoked by the merchant | No |
| `403` | `AGENT_PAUSED` | Agent access is temporarily paused by the merchant | Yes (after merchant un-pauses) |
| `403` | `PER_TX_LIMIT_EXCEEDED` | Payment exceeds the agent's per-transaction limit | No (reduce amount) |
| `403` | `DAILY_LIMIT_EXCEEDED` | Payment would exceed the agent's daily spending cap | Yes (after UTC midnight reset) |
| `403` | `SPENDING_LIMIT_EXHAUSTED` | On-chain Squads spending limit has been used up | Yes (after limit replenishment) |
| `404` | -- | Transaction or merchant not found | No |
| `429` | -- | Rate limit exceeded | Yes (after `Retry-After` seconds) |
| `451` | `SANCTIONED_ADDRESS` | OFAC compliance block -- address is on a sanctions list | No |
| `500` | `INTERNAL_ERROR` | Facilitator internal error | Yes (with backoff) |
| `503` | -- | Service is shutting down (graceful drain) | Yes (after `Retry-After` seconds) |

## Error Response Shapes

### 400 -- Invalid Request

Returned when the request body fails Zod schema validation. The `details` array contains one entry per validation issue, following the [Zod issue format](https://zod.dev/?id=error-handling).

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["paymentRequirements", "scheme"],
      "message": "Required"
    }
  ]
}
```

The `/v1/settle-direct` route can also return 400 for chain-level validation:

```json
{
  "error": "Direct settlement only supports Solana networks"
}
```

Or for merchants not registered on-chain:

```json
{
  "error": "Merchant is not registered on-chain. Use /v1/settle for x402 settlement."
}
```

### 401 -- Authentication Failed

Missing API key:

```json
{
  "error": "Missing API key"
}
```

Invalid or deactivated API key:

```json
{
  "error": "Invalid API key"
}
```

The facilitator expects the key in the `x-pincerpay-api-key` header. Keys are validated by a hashed lookup (HMAC-SHA256 with a server pepper, with a legacy SHA-256 fallback during the migration window), never by storing the raw key. Only active keys pass authentication -- if you have deactivated a key in the dashboard, it will return 401 even if the key string is correct.

### 402 -- Payment Required

This status is returned by the **merchant middleware** (via `@pincerpay/merchant` or `@x402/hono`), not by the facilitator directly. It signals that the requested resource requires an x402 payment. The response body contains the `paymentRequirements` object that the agent uses to construct a signed transaction.

```json
{
  "x402Version": 2,
  "paymentRequirements": {
    "scheme": "exact",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "amount": "1000000",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "token": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "facilitatorUrl": "https://facilitator.pincerpay.com"
  }
}
```

### 404 -- Not Found

Transaction lookup miss (from `GET /v1/status/:txHash`):

```json
{
  "error": "Transaction not found"
}
```

Merchant not found (from `/v1/settle-direct`):

```json
{
  "error": "Merchant not found"
}
```

### 429 -- Rate Limit Exceeded

```json
{
  "error": "Rate limit exceeded"
}
```

Always accompanied by rate limit headers. See the [Rate Limiting](#rate-limiting) section below for details.

### 451 -- OFAC Compliance Block

Returned when a payer or payee address matches the OFAC Specially Designated Nationals (SDN) list. This check runs on `/v1/settle` and `/v1/settle-direct` when OFAC screening is enabled.

```json
{
  "error": "Unavailable For Legal Reasons",
  "code": "SANCTIONED_ADDRESS",
  "message": "Address is on a sanctions list"
}
```

This is a terminal error. The address cannot be used for settlement through PincerPay.

### 500 -- Internal Error

Settlement failure:

```json
{
  "success": false,
  "errorReason": "INTERNAL_ERROR",
  "errorMessage": "Settlement failed due to an internal error",
  "transaction": "",
  "network": ""
}
```

Verification failure:

```json
{
  "isValid": false,
  "invalidReason": "INTERNAL_ERROR",
  "invalidMessage": "Verification failed due to an internal error"
}
```

Note that the response shape differs between `/v1/settle` and `/v1/verify`. Settlement errors include `errorReason`/`errorMessage`; verification errors include `invalidReason`/`invalidMessage`. Both use the `INTERNAL_ERROR` code.

### 503 -- Service Shutting Down

```json
{
  "error": "Service is shutting down, retry on another instance"
}
```

The response includes a `Retry-After: 1` header. This occurs during graceful shutdown (after the facilitator receives SIGTERM). The `/health` endpoint also returns 503 during shutdown with status `"shutting_down"`.

## Agent Spending Limit Errors

All five agent spending limit errors return HTTP 403. They are enforced by the Squads middleware on `/v1/settle` and `/v1/settle-direct` for Solana payments. Each error includes a `code` field for programmatic handling.

### AGENT_REVOKED

The merchant has permanently revoked this agent's access. The agent cannot make any payments to this merchant.

```json
{
  "error": "Agent access has been revoked",
  "code": "AGENT_REVOKED"
}
```

**How to resolve:** The merchant must change the agent's status back to `active` via the dashboard or the `PATCH /v1/agents/:id` endpoint.

### AGENT_PAUSED

The merchant has temporarily paused this agent. This is typically used for maintenance or investigation.

```json
{
  "error": "Agent access is paused",
  "code": "AGENT_PAUSED"
}
```

**How to resolve:** The merchant must un-pause the agent via the dashboard or `PATCH /v1/agents/:id` with `{ "status": "active" }`.

### PER_TX_LIMIT_EXCEEDED

The payment amount exceeds the agent's configured per-transaction maximum. The response includes both the limit and the requested amount (in base units, e.g., USDC with 6 decimals).

```json
{
  "error": "Per-transaction spending limit exceeded",
  "code": "PER_TX_LIMIT_EXCEEDED",
  "maxPerTransaction": "5000000",
  "requested": "10000000"
}
```

In this example, the agent's per-transaction limit is 5 USDC but the payment requires 10 USDC.

**How to resolve:** Either reduce the payment amount to fit within `maxPerTransaction`, or have the merchant increase the limit via `PATCH /v1/agents/:id` with `{ "maxPerTransaction": "10000000" }`.

### DAILY_LIMIT_EXCEEDED

The payment would push the agent's total spending for the current UTC day over its daily cap. The response includes the daily limit, how much the agent has already spent today, and the requested amount.

```json
{
  "error": "Daily spending limit exceeded",
  "code": "DAILY_LIMIT_EXCEEDED",
  "maxPerDay": "50000000",
  "dailySpend": "48000000",
  "requested": "5000000"
}
```

In this example, the agent has a 50 USDC daily cap, has already spent 48 USDC today, and is requesting 5 USDC (which would bring the total to 53 USDC).

**How to resolve:** Wait for the daily limit to reset at UTC midnight (00:00 UTC). Alternatively, the merchant can increase `maxPerDay` via `PATCH /v1/agents/:id`. The daily spend counter is calculated from the `transactions` table in real time -- it is not a cached value, so it resets precisely at midnight UTC.

### SPENDING_LIMIT_EXHAUSTED

The agent's on-chain Squads Smart Account spending limit has been fully consumed. This is enforced by reading the Squads spending limit PDA on-chain.

```json
{
  "error": "Spending limit exhausted",
  "code": "SPENDING_LIMIT_EXHAUSTED",
  "remaining": "0",
  "requested": "1000000"
}
```

**How to resolve:** The agent's Squads spending limit must be replenished on-chain. This is managed through the Squads protocol -- the multisig authority needs to approve a new spending limit or increase the existing one.

## Retry Strategies

### Terminal Errors (Do Not Retry)

These errors indicate a problem that will not resolve by retrying the same request:

- **400** -- Fix the request body. Check `details` array for specific validation issues.
- **401** -- Fix the API key. Verify the header name is `x-pincerpay-api-key` and the key is active.
- **403 AGENT_REVOKED** -- Agent is permanently blocked. Requires merchant action.
- **403 PER_TX_LIMIT_EXCEEDED** -- Reduce the payment amount or request a limit increase.
- **404** -- The resource does not exist.
- **451** -- Sanctioned address. Cannot be resolved through PincerPay.

### Conditionally Retryable Errors

These errors will resolve on their own or with a specific action:

- **402** -- Submit a valid signed payment transaction.
- **403 AGENT_PAUSED** -- Wait for the merchant to un-pause the agent, then retry.
- **403 DAILY_LIMIT_EXCEEDED** -- Retry after UTC midnight, or after the merchant increases the limit.
- **403 SPENDING_LIMIT_EXHAUSTED** -- Retry after the on-chain spending limit is replenished.

### Retryable Errors (Use Backoff)

These errors are transient and should be retried with exponential backoff:

- **429** -- Rate limit hit. Wait at least `Retry-After` seconds before retrying.
- **500** -- Internal facilitator error. Retry with exponential backoff.
- **503** -- Service is draining. Wait `Retry-After` seconds (typically 1 second), then retry. The request will be routed to a healthy instance.

### Recommended Backoff Strategy

For retryable errors (429, 500, 503), use exponential backoff with jitter:

```
attempt 1: wait 1s + random(0-500ms)
attempt 2: wait 2s + random(0-500ms)
attempt 3: wait 4s + random(0-500ms)
attempt 4: wait 8s + random(0-500ms)
attempt 5: wait 16s + random(0-500ms)
```

For 429 responses, always respect the `Retry-After` header -- it tells you exactly when the rate limit window resets. Do not retry before that time.

Cap retries at 5 attempts. If the request still fails after 5 retries, surface the error to the caller.

## Rate Limiting

The facilitator enforces rate limits at two levels: a global per-key limit and stricter route-specific limits.

### Global Limit

All authenticated endpoints share a global rate limit of **120 requests per minute** per API key (configurable by the facilitator operator). The window is a sliding 60-second window.

### Route-Specific Limits

Expensive routes have additional stricter limits that are tracked separately from the global counter:

| Route | Limit | Window |
|-------|-------|--------|
| `POST /v1/settle` | 50 requests | 60 seconds |
| `POST /v1/settle-direct` | 50 requests | 60 seconds |
| `POST /v1/verify` | 100 requests | 60 seconds |
| CRUD routes (`/v1/paywalls`, `/v1/agents`, `/v1/webhooks`) | 30 requests | 60 seconds |

A request can be rejected by either the global limit or the route-specific limit, whichever is hit first.

### Rate Limit Headers

Every authenticated response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |

When the limit is exceeded, the response also includes:

| Header | Description |
|--------|-------------|
| `Retry-After` | Seconds until the rate limit window resets |

### Handling Rate Limits

1. Monitor `X-RateLimit-Remaining` proactively. If it drops below 10, slow down.
2. When you receive a 429, read the `Retry-After` header and pause all requests for that many seconds.
3. If you are building a high-throughput integration, batch operations where possible and spread requests across the window rather than bursting.

## Common Troubleshooting Scenarios

### "My agent gets 402 but I think the payment was sent"

The 402 response comes from the **merchant middleware**, not the facilitator. If your agent submitted a payment but is still getting 402, the settlement may not have completed. Check the transaction status:

```
GET https://facilitator.pincerpay.com/v1/status/{txHash}
```

Possible outcomes:

- **Status `optimistic`**: The transaction was broadcast but not yet confirmed on-chain. The merchant middleware may not have received the settlement confirmation yet. Wait a few seconds and retry the original resource request.
- **Status `confirmed`**: The transaction is confirmed on-chain. The merchant middleware should be accepting this payment. Check that the agent is sending the correct `X-PAYMENT` or `X-PAYMENT-RESPONSE` header with the settlement proof.
- **Status `failed`**: The transaction failed on-chain (e.g., insufficient funds, invalid signature). The agent needs to construct and submit a new payment.
- **404 (Transaction not found)**: The settlement was never recorded by the facilitator. The agent's payment submission may have failed before reaching the facilitator. Check the agent's logs for errors from the `/v1/settle` call.

### "Agent is getting DAILY_LIMIT_EXCEEDED"

1. **Check current spending**: Query `GET /v1/transactions?agent={agentId}` to see how much the agent has spent today.
2. **Review the limit**: Check the agent's `maxPerDay` via `GET /v1/agents/{agentId}`.
3. **Adjust if needed**: Increase the limit with `PATCH /v1/agents/{agentId}` and set a higher `maxPerDay` value (in base units -- e.g., `"100000000"` for 100 USDC).
4. **Wait for reset**: Daily spending counters reset at **UTC midnight (00:00 UTC)**. The counter is computed from the `transactions` table in real time, so there is no cache lag.

### "Webhook not being received"

1. **Check delivery status in the dashboard**: Go to the [webhooks section](https://www.pincerpay.com/dashboard) to see recent webhook deliveries and their status (`delivered`, `retrying`, or `failed`).
2. **Verify the webhook URL is reachable**: The facilitator makes an HTTPS POST to your configured URL. Ensure the URL is publicly accessible (not `localhost` or behind a VPN). The facilitator times out after 10 seconds per attempt.
3. **Check your firewall and TLS**: The webhook request comes from the facilitator's Railway deployment. Ensure your firewall allows inbound HTTPS from external IPs.
4. **Verify signature validation**: If your endpoint is rejecting webhooks, check that you are computing the HMAC-SHA256 signature correctly. The signed content is `{timestamp}.{rawBody}` using your webhook signing secret. See the [API Reference](/docs/api-reference#signature-verification) for the full verification algorithm.
5. **Retry behavior**: Failed deliveries are retried up to 5 times with exponential backoff (1s, 5s, 30s, 2min, 10min). If all retries fail, the delivery is marked `failed`. You can see the retry count and last error in the dashboard.

### "Transaction stuck in optimistic"

Transactions under 1 USDC use optimistic finality -- the facilitator returns success after broadcasting to the mempool, before block confirmation. The confirmation worker then polls for on-chain confirmation.

If a transaction stays in `optimistic` status for more than a few minutes:

1. **Check the confirmation worker**: Hit `GET /health` on the facilitator. The response includes a `workers.confirmation` object showing the worker's status, last run time, and consecutive error count.
   ```json
   {
     "status": "ok",
     "workers": {
       "confirmation": {
         "lastRunAt": "2026-03-07T12:00:00.000Z",
         "consecutiveErrors": 0,
         "processedCount": 142
       }
     }
   }
   ```
   If `consecutiveErrors` is 3 or higher, the worker is degraded and the overall status will show `"degraded"`.

2. **Check the chain**: The transaction may have been dropped by the network (Solana) or is waiting for inclusion in a block. Look up the `txHash` on a block explorer ([Solana Explorer](https://explorer.solana.com/) or [Solscan](https://solscan.io/)) to see its on-chain state.

3. **RPC issues**: If the facilitator's RPC endpoint is slow or rate-limited, the confirmation worker may be falling behind. The `/health` endpoint will show this as worker degradation.

4. **Expected behavior for Solana**: Solana transactions typically confirm within 400ms-2s. If the transaction hash shows as confirmed on a block explorer but PincerPay still shows `optimistic`, the confirmation worker will catch up on its next poll cycle (every few seconds).

### "Getting 500 errors on /v1/settle"

Internal errors on the settlement route usually indicate an issue with the facilitator's connection to the blockchain or its signing infrastructure.

1. **Check `/health`**: If the database is `"disconnected"` or workers are degraded, the facilitator has infrastructure issues.
2. **Verify the chain is correct**: Ensure `paymentRequirements.network` matches a chain the facilitator supports. Check `GET /v1/supported` for the list of registered chains.
3. **Transaction construction**: If the x402 transaction is malformed (wrong instruction order, invalid compute budget, incorrect mint), the underlying `@x402/svm` or `@x402/evm` library will reject it. The error will surface as a 500 because it happens inside `facilitator.settle()`. Double-check that your transaction follows the [x402 SVM transaction format](/docs/x402#transaction-format) or EVM requirements.
4. **Retry with backoff**: Transient 500 errors (RPC timeouts, network congestion) often resolve on retry. Use the backoff strategy described above.
