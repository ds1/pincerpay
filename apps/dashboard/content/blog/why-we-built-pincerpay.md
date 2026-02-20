---
title: Why We Built PincerPay
description: Card rails weren't designed for machines. We built the payment infrastructure that was.
date: 2026-02-20
author: PincerPay Team
tags: [announcement, vision, x402]
---

Stripe charges $0.30 + 2.9% per transaction. For a $0.01 API call, that's a 3,100% fee. Card rails weren't built for machines making thousands of micropayments per hour. x402 was.

## The Problem

AI agents are going from copilots to autonomous actors. They browse, they decide, they transact. But when an agent needs to pay for an API call, a dataset, or a compute job, it hits a wall built in the 1960s: credit card rails.

Card networks assume a human at the keyboard. 3D Secure. CAPTCHAs. Visual consent screens. Expiration dates on plastic. None of this works when the "customer" is a Python process running in a container.

The workarounds are predictable and bad:

- **Hard-code API keys everywhere** — no per-request metering, no spending controls
- **Prepaid credits on each platform** — siloed balances, no interoperability
- **Custodial wallets** — hand a third party control of your agent's money and hope they're honest

Every one of these is a hack around the real problem: there is no native payment protocol for machine-to-machine commerce over HTTP.

## HTTP 402

HTTP status code 402 — "Payment Required" — has been reserved since 1997. For 29 years, the spec said "reserved for future use." x402 is the future it was waiting for.

The protocol is simple:

1. Agent requests a resource
2. Server returns `402` with a payment requirement (amount, token, chain, recipient)
3. Agent signs a stablecoin transfer
4. Facilitator verifies and broadcasts the transaction
5. Agent retries with proof of payment
6. Server delivers the resource

No accounts. No API keys. No invoices. Just HTTP and signed transactions.

## Why PincerPay Exists

x402 defines the protocol. PincerPay builds the infrastructure.

We're the facilitator that verifies and settles payments. We're the middleware that merchants drop into Express or Hono. We're the SDK that wraps `fetch()` so agents pay automatically. We're the dashboard where merchants manage paywalls, track transactions, and generate API keys.

### What we chose and why

**Solana-first.** Sub-second finality, sub-cent fees, and Kora integration so agents pay gas in USDC instead of holding SOL. Solana is where the speed and cost economics make micropayments viable.

**Non-custodial.** Agents hold their own keys. PincerPay verifies and broadcasts transactions but never controls funds. This isn't a philosophical choice — it's a security one. Custodial agent wallets are a single point of failure at scale.

**Open standard.** We implement x402, not a proprietary protocol. If someone builds a better facilitator tomorrow, agents and merchants can switch without changing their code. We win by being the best implementation, not by locking people in.

**Spending policies.** Autonomous doesn't mean uncontrolled. The Agent SDK enforces per-transaction limits, daily budgets, merchant allowlists, and chain restrictions. For more, Squads SPN provides on-chain session keys with policy co-signing.

## What This Looks Like

For a merchant, it's three lines of middleware:

```typescript
app.use(pincerpay({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_WALLET",
  routes: {
    "GET /api/weather": { price: "0.01", chain: "solana" },
  },
}));
```

For an agent, it's a wrapped fetch:

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_KEY!,
});

const res = await agent.fetch("https://weather-api.com/api/weather");
```

The agent doesn't know or care about x402 details. It calls `fetch()`, the SDK handles the 402 handshake, and the response comes back with weather data.

## What's Next

We're live today. Merchants can accept USDC from agents on Solana, Base, and Polygon. The dashboard is at [pincerpay.com](https://pincerpay.com). The SDKs are on npm.

What we're building next:

- **Kora gasless transactions** — agents pay gas in USDC, no SOL needed
- **Squads SPN session keys** — on-chain spending limits with policy co-signing
- **On-chain facilitator** — Anchor program for direct Solana settlement
- **Micropayment batching** — ZK compression for high-throughput sub-cent payments

The agentic economy needs payment infrastructure built for machines. That's what PincerPay is.

[Get started in 5 minutes](/docs/getting-started) or [read the full documentation](/docs).
