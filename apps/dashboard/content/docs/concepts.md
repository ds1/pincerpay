---
title: Core Concepts
description: How the x402 protocol, AP2 mandates, and UCP discovery work together.
order: 4
section: Learn
---

PincerPay is built on three open protocols: **x402** for payment settlement, **AP2** for authorization, and **UCP** for agent-readable commerce discovery.

## x402: HTTP-Native Payments

HTTP status code 402 ("Payment Required") has existed since 1997. The x402 protocol finally gives it a concrete implementation.

### The Flow

1. Agent sends `GET /api/data` to a merchant
2. Merchant returns `402 Payment Required` with a JSON body:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "10000",
      "resource": "https://merchant.com/api/data",
      "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "extra": {
        "name": "Premium weather data",
        "facilitatorUrl": "https://facilitator.pincerpay.com"
      }
    }
  ]
}
```

3. Agent signs a USDC transfer and POSTs it to the facilitator's `/verify` endpoint
4. Facilitator verifies the transaction, broadcasts it on-chain, returns a receipt
5. Agent retries the original request with the receipt in the `X-PAYMENT` header
6. Merchant verifies the receipt and serves the resource

### Why This Matters

- **No API keys to manage** — agents pay per-request, no account creation needed
- **No rate limits** — every request that pays gets served
- **No invoicing** — settlement is instant, on-chain, final
- **Any HTTP endpoint** — works with REST, GraphQL, file downloads, anything over HTTP

## AP2: Authorization Protocol

AP2 adds authorization scoping to agent payments. Three mandate types control what agents can spend:

### Intent Mandates

Autonomous spending within limits. The agent operates freely within the mandate's constraints.

```
"I authorize this agent to spend up to 5 USDC/day on weather APIs."
```

- Set by the agent's owner (human or organization)
- Enforced client-side by the SDK and optionally on-chain via Squads SPN
- Suitable for routine, low-value transactions

### Cart Mandates

Human-in-the-loop approval for specific purchases. The agent proposes a transaction, a human approves or rejects.

```
Agent: "I want to buy a $50 dataset from DataCorp."
Human: [Approve] [Reject]
```

- Used for high-value or unusual transactions
- Maps naturally to n8n's human-in-the-loop and AI SDK's `needsApproval`
- The human sees what, how much, and who before funds move

### Payment Mandates

Execution-level authorization. A signed instruction that the facilitator validates before broadcasting.

- Created after Intent or Cart approval
- Contains the exact transaction parameters
- Single-use, time-bounded, amount-specific

## UCP: Agent-Readable Commerce Discovery

The Universal Commerce Protocol lets agents discover what a merchant sells, how to pay, and what they'll get.

### The Manifest

Merchants publish a `/.well-known/ucp` JSON manifest:

```json
{
  "name": "WeatherAPI",
  "description": "Real-time weather data for AI agents",
  "version": "1.0",
  "payment": {
    "handler": "pincerpay",
    "chains": ["solana"],
    "token": "USDC"
  },
  "endpoints": [
    {
      "path": "/api/weather",
      "method": "GET",
      "price": "0.01",
      "description": "Current weather for a given location",
      "params": {
        "city": { "type": "string", "required": true }
      }
    }
  ]
}
```

### How Agents Use It

1. Agent fetches `https://merchant.com/.well-known/ucp`
2. Agent reads available endpoints, prices, and required parameters
3. Agent decides whether to purchase based on its mandate and budget
4. Agent calls the endpoint, handles the 402 flow, gets the data

UCP turns every API into a browsable storefront for agents.

## Chain Architecture

### Solana (Primary)

PincerPay is Solana-first. Solana offers:

- **Sub-second finality** — transactions confirm in ~400ms
- **Sub-cent fees** — a USDC transfer costs ~$0.00025
- **Kora gasless** — agents pay gas in USDC instead of SOL (no need to hold native token)
- **Squads SPN** — on-chain session keys with spending limits

### EVM (Optional Compatibility)

Base and Polygon are supported for agents and merchants that prefer EVM:

- **Base** — Coinbase's L2, co-creators of x402
- **Polygon** — low fees, established ecosystem
- **ERC-7715** — session keys for scoped agent permissions

### Chain Identifiers

| Shorthand | CAIP-2 ID | Network |
|-----------|-----------|---------|
| `solana` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Solana Mainnet |
| `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Solana Devnet |
| `base` | `eip155:8453` | Base Mainnet |
| `base-sepolia` | `eip155:84532` | Base Sepolia |
| `polygon` | `eip155:137` | Polygon Mainnet |
| `polygon-amoy` | `eip155:80002` | Polygon Amoy |
