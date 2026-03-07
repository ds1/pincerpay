---
title: "Why We Built PincerPay"
description: "AI agents transact at machine speed and machine scale. An agent can make thousands of API calls per minute, negotiate prices, switch providers, and consume serv"
date: "2026-03-07"
author: "PincerPay Team"
tags: [x402, agent payments, USDC, origin story]
---

# Why We Built PincerPay

AI agents transact at machine speed and machine scale. An agent can make thousands of API calls per minute, negotiate prices, switch providers, and consume services autonomously. But the payment layer is still built on card rails designed for $50 restaurant tabs, running through custodial intermediaries who charge fixed fees that dwarf the transaction value. PincerPay exists because agents need a payment protocol native to HTTP, not one layered on top of 1970s interchange infrastructure.

## Card Rails at Machine Scale

Card networks have started adapting. Visa now issues virtual cards for AI agents, and Stripe offers agent-specific card products. Agents can technically pay with cards. The question is whether card rails are the right abstraction for how agents actually transact.

A $0.01 API call costs $0.31 through Stripe after the $0.30 fixed fee per transaction. That fixed fee makes sub-cent micropayments economically impossible on card rails, regardless of whether the cardholder is human or software. Settlement takes T+1 to T+3 days, while the agent needs the API response in milliseconds. And every card transaction routes through a custodial processor who holds the funds before forwarding them to the merchant.

Agents need per-request pricing at sub-cent granularity, settlement that completes before the HTTP response, and a non-custodial path where funds move directly from buyer to seller on-chain.

## x402: HTTP-Native Payments

The x402 protocol uses HTTP status code 402 (Payment Required) to create a native payment negotiation layer inside HTTP itself. Coinbase published the protocol spec and it has 5,400+ stars on GitHub. Here is how a payment flows:

1. Agent sends `GET /api/weather` to a merchant server
2. Merchant responds with `402 Payment Required` and a payment header containing the price, recipient wallet, and accepted token
3. Agent reads the 402 response, constructs a USDC transaction for the stated amount, and signs it with its private key
4. Agent resends the request with an `X-PAYMENT` header containing the signed transaction
5. Merchant's middleware forwards the payment to a facilitator, which verifies the signature and broadcasts the transaction on Solana
6. Facilitator returns a receipt, merchant returns the API response

The entire round trip settles with ~200ms optimistic finality for amounts under $1. Larger transactions wait for full Solana confirmation. There is no intermediary holding funds and no fixed per-transaction fee that makes micropayments unviable.

## What PincerPay Does

PincerPay is the x402 gateway that handles steps 2 through 6. Merchants install `@pincerpay/merchant` and wrap their endpoints with a paywall:

```typescript
import { createPaywall } from "@pincerpay/merchant";

const paywall = createPaywall({
  price: "0.001",
  token: "USDC",
  network: "solana",
  recipient: "YOUR_WALLET_ADDRESS",
});

app.use("/api/weather", paywall);
```

Agents install `@pincerpay/agent` and wrap their HTTP client:

```typescript
import { createPincerAgent } from "@pincerpay/agent";

const agent = createPincerAgent({ privateKey: AGENT_PRIVATE_KEY });
const response = await agent.fetch("https://api.example.com/api/weather");
```

The agent SDK detects 402 responses, signs the payment, and retries the request automatically. USDC settles directly to the merchant's wallet on Solana.

## Non-Custodial by Design

Agents sign their own transactions with their own private keys. When a payment settles, USDC moves from the agent wallet to the merchant wallet on-chain. The facilitator verifies signatures and broadcasts transactions but never takes custody of funds.

Spending limits enforce safety at three layers: the SDK caps per-request and per-session amounts, the facilitator enforces daily and total budget limits, and on-chain Squads SPN session keys restrict what the agent's keypair can authorize. All three layers must agree before a transaction goes through.

## Open Protocols

PincerPay builds on three open protocols with real production adoption:

- **x402** (Coinbase): HTTP-native payment negotiation. 5,400+ GitHub stars. Any x402-compatible facilitator or agent SDK can participate.
- **AP2** (Google): Agent-to-agent trust and authorization. 60+ partners in the authorization network.
- **UCP** (Google + Shopify): Universal capability and pricing discovery. 20+ partners. Agents find services and prices through a standard manifest format.

These are not PincerPay-specific protocols. Any compatible implementation works with any other compatible implementation. PincerPay succeeds when the protocol ecosystem grows, even if others build competing facilitators.

## What's Next

PincerPay 0.18.0 is live and open source under MIT. Solana USDC settlement, Squads SPN spending limits, and Kora gasless signing are all in production.

Install the packages and start building:

```bash
npm install @pincerpay/core @pincerpay/solana @pincerpay/agent @pincerpay/merchant @pincerpay/mcp
```

Try a payment in the [live demo](https://demo.pincerpay.com), read the [integration docs](https://pincerpay.com/docs), or browse the [source on GitHub](https://github.com/ds1/pincerpay).
