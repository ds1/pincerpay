---
title: Testing
description: Set up devnet/testnet environments for local development and testing.
order: 6
section: Reference
---

PincerPay supports devnet and testnet chains for development. Use these to test the full payment flow without spending real USDC.

## Devnet Configuration

### Merchant

Point your paywall at a devnet chain:

```typescript
pincerpay({
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
import express from "express";
import { pincerpay } from "@pincerpay/merchant";
import { PincerPayAgent } from "@pincerpay/agent";

// 1. Start merchant
const app = express();
app.use(
  pincerpay({
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
app.get("/api/data", (req, res) => res.json({ result: "success" }));

const server = app.listen(4000);

// 2. Create agent and pay
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

const res = await agent.fetch("http://localhost:4000/api/data");
console.log(await res.json()); // { result: "success" }

server.close();
```
