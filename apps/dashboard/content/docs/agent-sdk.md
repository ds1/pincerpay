---
title: Agent SDK
description: Give your AI agent a wallet. Pay for any paywalled resource automatically.
order: 3
section: SDKs
---

The `@pincerpay/agent` package wraps the standard `fetch()` API. When your agent hits a `402 Payment Required` response, the SDK automatically signs a USDC payment, submits it to the facilitator, and retries the request. Your agent code never sees the 402.

## Installation

```bash
npm install @pincerpay/agent
```

## Basic Usage

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "100000",  // 0.10 USDC (6 decimals)
      maxPerDay: "5000000",         // 5.00 USDC
    },
  ],
});

// Drop-in replacement for fetch
const response = await agent.fetch("https://api.example.com/weather");
const data = await response.json();
```

`agent.fetch()` works identically to the standard `fetch()` API. It accepts the same arguments and returns the same `Response` object.

## What Happens Under the Hood

When `agent.fetch()` receives a `402 Payment Required` response:

1. Reads the payment requirements from the response headers
2. Validates the request against your spending policies
3. Signs a USDC transfer for the requested amount
4. Sends the signed transaction to the PincerPay facilitator
5. Retries the original request with proof of payment
6. Returns the successful response

## EVM Agents

```typescript
const agent = await PincerPayAgent.create({
  chains: ["base"],
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
  policies: [
    { maxPerTransaction: "100000", maxPerDay: "5000000" },
  ],
});
```

## Multi-Chain Agents

Agents can hold keys for multiple chains. The SDK selects the right chain based on the merchant's 402 response:

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana", "base"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
});
```

## Spending Policies

Policies are enforced client-side before signing any transaction. If a payment would violate a policy, the SDK throws instead of signing.

| Option | Type | Description |
|--------|------|-------------|
| `maxPerTransaction` | `string` | Max USDC per single payment (base units, 6 decimals) |
| `maxPerDay` | `string` | Max USDC spend per 24-hour rolling window |
| `allowedMerchants` | `string[]` | Restrict payments to specific wallet addresses |
| `allowedChains` | `string[]` | Restrict to specific chains |

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "100000",   // Max $0.10 per payment
      maxPerDay: "5000000",          // Max $5.00 per day
      allowedMerchants: [            // Only pay these wallets
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      ],
    },
  ],
});
```

## Solana Smart Agent (Advanced)

For agents using Squads Protocol smart accounts with on-chain spending limits:

```typescript
import { SolanaSmartAgent } from "@pincerpay/agent";

const agent = await SolanaSmartAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  smartAccountIndex: 0,
  spendingLimitIndex: 0,
});

// Check on-chain spending policy before payment
const policy = await agent.checkOnChainPolicy("100000");
if (policy.allowed) {
  const response = await agent.fetch("https://api.example.com/data");
}

// Direct on-chain settlement (bypasses x402 for Solana-native)
const result = await agent.settleDirectly("MERCHANT_ID", "100000");
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_SOLANA_KEY` | For Solana | Solana private key (base58 encoded) |
| `AGENT_EVM_KEY` | For EVM | EVM private key (hex, `0x` prefixed) |

## Testing

Use devnet/testnet chains during development:

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});
```

### Getting Test USDC

- **Solana devnet**: Use the [Circle faucet](https://faucet.circle.com) for devnet USDC
- **Base Sepolia**: Use the [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
