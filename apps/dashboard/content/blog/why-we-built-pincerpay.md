---
title: "Why We Built PincerPay"
description: "AI agents can't use credit cards. PincerPay is x402-native payment infrastructure that lets agents pay for APIs with USDC on Solana."
date: "2026-02-24"
author: "PincerPay Team"
tags: [origin, x402, agents, payments, solana]
---

# Why We Built PincerPay

AI agents make thousands of API calls per hour. They don't have credit cards, billing addresses, or thumbs for 3D Secure. The entire card payment stack assumes a human is on the other side. That assumption is breaking.

PincerPay exists because agents need a payment protocol that speaks HTTP and settles on-chain. Not a card wrapper. Not a custodial wallet. A native protocol layer where an agent can pay $0.001 for a weather lookup and the merchant receives $0.001, settled in USDC on Solana in under 200 milliseconds.

## The Problem: Card Rails Were Built for Humans

Every card transaction assumes a cardholder. A billing address. A 16-digit number embossed on plastic. A fraud model built around human spending patterns. This architecture made sense for decades. It does not make sense when the buyer is a Python script running in a container.

Here is what happens when an agent tries to pay $0.01 for an API call through Stripe:

- Stripe charges $0.30 + 2.9%. The agent pays $0.31 for a penny of data.
- Settlement takes T+1 to T+3. The merchant waits days for funds.
- The agent needs an API key tied to a human account, a stored card, and a billing agreement signed by a person.

Now multiply that by the thousands of API calls an agent makes per day, across dozens of services. The math collapses. The architecture collapses. The requirement for a human in the loop collapses.

Agents need three things from a payment system:

1. **Autonomous execution.** Pay without waiting for human approval on every transaction.
2. **Micropayment economics.** A $0.001 payment should not cost $0.30 in fees.
3. **Sub-second settlement.** The agent is holding an HTTP request open. It cannot wait two business days.

Card rails deliver none of these.

## The Solution: x402 and Stablecoin Settlement

The x402 protocol, created by Coinbase and now adopted by over 5,400 developers on GitHub, repurposes the HTTP 402 status code for machine-native payments. The flow is simple:

1. Agent sends an HTTP request to a paywalled endpoint.
2. Server responds with `402 Payment Required` and includes the price, token (USDC), chain (Solana), and facilitator URL.
3. Agent signs a USDC transfer and submits it to the facilitator.
4. Facilitator verifies the signature and broadcasts the transaction.
5. Agent retries the original request with proof of payment.
6. Server verifies the receipt and returns the data.

No card number. No billing address. No human. The agent reads the 402 response, signs a transaction, and gets its data. The entire round trip takes about 200 milliseconds for payments under $1.

PincerPay is the infrastructure that makes this production-ready.

## What PincerPay Actually Is

PincerPay is an x402 payment gateway. It sits between agents and merchants, handling the verification, broadcasting, and settlement of USDC payments on Solana (with optional Base and Polygon support).

For merchants, integration is a few lines of Express middleware:

```typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Weather data",
      },
    },
  })
);
```

That endpoint now accepts USDC from any x402-compatible agent. No billing infrastructure. No Stripe dashboard. No invoice reconciliation. The merchant receives USDC directly into their wallet.

For agents, it is equally minimal:

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

const response = await agent.fetch("https://api.example.com/weather");
```

The agent SDK wraps `fetch()`. When it encounters a 402 response, it reads the payment terms, signs the transaction, submits it, and retries the request. The SDK handles the payment flow automatically.

## Why Non-Custodial Matters

PincerPay never holds funds. Agents sign their own transactions with their own keys. USDC moves directly from the agent's wallet to the merchant's wallet on Solana. The facilitator verifies and broadcasts, but never takes custody.

This is a deliberate architectural choice, not a limitation. Custodial payment systems create a single point of failure. If the custodian is hacked, every agent's funds are exposed. If the custodian goes down, no payments flow. If the custodian decides to freeze funds, the agent is stuck.

Non-custodial design means the security model scales with the agent, not with PincerPay. Each agent manages its own keys, its own balance, and its own risk surface.

## Why Agents and Merchants Both Win

### For agents

Agents gain the ability to pay for any x402-enabled API without pre-negotiated contracts, stored credentials, or human intermediaries. An agent hits a paywalled endpoint, reads the 402 response, pays in USDC, and gets the data. All in a single HTTP round trip.

The economics work at any scale. A $0.001 transaction costs roughly $0.0001 in Solana fees. Compare that to $0.31 on card rails. That is a 99.9% cost reduction.

Three layers of spending controls keep agents safe:

- **SDK-level policies** enforce per-request and daily spending limits before the agent signs any transaction.
- **Facilitator-level limits** check per-transaction and daily caps server-side before broadcasting.
- **On-chain limits** via Squads SPN Smart Accounts provide cryptographic spending boundaries that no software bug can override.

### For merchants

API providers gain a new revenue stream from AI traffic with zero billing infrastructure. No user accounts. No subscription management. No invoicing. The agent pays per request, and the merchant receives USDC directly.

The merchant configures routes with prices. The middleware handles everything else: returning the 402 challenge, verifying receipts, gating access. Settlement is on-chain. Revenue is visible in real time on the PincerPay dashboard.

For API providers already seeing significant AI agent traffic in their logs, PincerPay turns that traffic from a cost center into a revenue stream.

## Built on Open Standards

PincerPay is built on the x402 protocol (Coinbase, 5,400+ GitHub stars), an open standard for HTTP-native payments. Any x402-compatible facilitator works with PincerPay merchants. Any x402-compatible agent can pay a PincerPay-powered API.

Merchants can also publish a [UCP manifest](https://pincerpay.com/docs/ucp) (Universal Commerce Protocol, backed by Google and Shopify) at `/.well-known/ucp` so agents can discover their endpoints, pricing, and supported payment methods programmatically.

This is not a walled garden. It is plumbing.

## The Numbers

| Metric | Card Rails (Stripe) | PincerPay (Solana) |
|--------|--------------------|--------------------|
| Cost of a $0.01 transaction | $0.31 ($0.30 + 2.9%) | ~$0.0101 ($0.01 + ~$0.0001 gas) |
| Settlement time | T+1 to T+3 (business days) | ~200ms (optimistic finality) |
| Requires human cardholder | Yes | No |
| Custody model | Custodial (Stripe holds funds) | Non-custodial (direct wallet-to-wallet) |
| Micropayment viable | No ($0.30 minimum effective floor) | Yes (no minimum, gas is ~$0.0001) |

## Frequently Asked Questions

**What is PincerPay?**
PincerPay is an on-chain payment gateway that lets AI agents pay for API resources with USDC stablecoins via the x402 protocol. Merchants add middleware to their routes. Agents wrap their fetch calls. Settlement happens on Solana in about 200 milliseconds.

**How does PincerPay work?**
When an agent hits a paywalled endpoint, the server returns an HTTP 402 response with payment details. The agent SDK signs a USDC transfer, sends it to the PincerPay facilitator for verification and broadcasting, then retries the request with proof of payment. The merchant middleware verifies the receipt and serves the data.

**Is PincerPay custodial?**
No. PincerPay never holds funds. Agents sign transactions with their own keys. USDC moves directly from the agent's wallet to the merchant's wallet on-chain.

**What chains does PincerPay support?**
Solana is the primary chain. Base and Polygon are supported as optional secondary chains.

**What does PincerPay cost?**
PincerPay charges a 1% settlement fee on USDC volume. On-chain gas on Solana is approximately $0.0001 per transaction, paid by the agent in USDC via Kora (gasless transactions).

**How is PincerPay different from Stripe or traditional payment processors?**
Traditional processors use card rails designed for human cardholders, with minimum fees around $0.30 and settlement times of 1 to 3 business days. PincerPay uses stablecoin settlement on Solana: no minimum fee floor, sub-second settlement, and no requirement for a human in the loop.

## What's Next

PincerPay is live on Solana devnet with three layers of spending controls, Kora gasless transactions, an on-chain Anchor program, and OFAC compliance screening. The SDKs are published on npm: `@pincerpay/merchant`, `@pincerpay/agent`, `@pincerpay/core`, `@pincerpay/solana`, and `@pincerpay/mcp`.

On the roadmap: mainnet deployment, AP2 mandate validation for cryptographic authorization, agent identity via on-chain trust scores, micropayment batching, and cross-chain USDC bridging.

Agents are already making API calls at scale. The only missing piece was a payment layer built for them, not adapted from one built for humans.

Try the live demo at [demo.pincerpay.com](https://demo.pincerpay.com), explore the [docs](https://pincerpay.com/docs), or browse the source on [GitHub](https://github.com/ds1/pincerpay).
