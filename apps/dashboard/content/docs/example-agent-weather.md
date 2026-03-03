---
title: "Example: Weather Agent"
description: AI agent with spending policies that fetches data from a paywalled weather API.
order: 8.3
section: Examples
---

A minimal AI agent that uses `PincerPayAgent` to fetch weather data from a paywalled merchant endpoint. Demonstrates spending policies, automatic 402 handling, and error recovery.

## What it does

1. Creates a `PincerPayAgent` with Solana devnet wallet
2. Configures spending policies (1 USDC per transaction, 10 USDC per day)
3. Fetches weather data from a paywalled merchant endpoint
4. The SDK handles the full 402 payment flow automatically

![Payment flow for a weather API request](/docs/flow-visualizer.png)

## Agent code

```typescript
// src/index.ts
import { PincerPayAgent } from "@pincerpay/agent";

async function main() {
  const agent = await PincerPayAgent.create({
    chains: ["solana-devnet"],
    solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
    policies: [
      {
        maxPerTransaction: "1000000", // 1 USDC max per tx
        maxPerDay: "10000000",        // 10 USDC max per day
      },
    ],
  });

  console.log(`Agent address: ${agent.solanaAddress}`);

  const merchantUrl = process.env.MERCHANT_URL ?? "http://localhost:3001";

  console.log("Fetching weather data (paywalled)...");
  try {
    const response = await agent.fetch(`${merchantUrl}/api/weather`);

    if (response.ok) {
      const data = await response.json();
      console.log("Weather data received:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Request failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

main().catch(console.error);
```

## Spending policies

Policies are enforced client-side before any transaction is signed. If a payment would exceed the limits, the SDK throws an error and no USDC is spent.

| Option | Type | Description |
|--------|------|-------------|
| `maxPerTransaction` | `string` | Max USDC per single payment (base units, 6 decimals) |
| `maxPerDay` | `string` | Max USDC per rolling 24-hour window |
| `allowedMerchants` | `string[]` | Only pay these wallet addresses |
| `allowedChains` | `string[]` | Only pay on these chains |

In this example, the agent allows up to 1 USDC per transaction and 10 USDC per day. See the [Agent SDK Reference](/docs/agent-sdk) for runtime policy management.

## Setup

1. Create a `.env` file:

```bash
AGENT_SOLANA_KEY=your_base58_private_key
MERCHANT_URL=http://localhost:3001
```

2. Fund the agent wallet on devnet:

```bash
# SOL (for gas)
solana airdrop 2 <agent-address> --url devnet

# USDC (for payments) — use the Circle faucet:
# https://faucet.circle.com (select Solana, Devnet, USDC)
```

3. Install dependencies from the monorepo root:

```bash
pnpm install
```

4. Start a merchant server (e.g., the [Express example](/docs/example-express-merchant)), then run the agent:

```bash
pnpm --filter example-agent-weather start
```

## Expected output

```
Agent address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
Fetching weather data (paywalled)...
Weather data received:
{
  "temperature": 72,
  "conditions": "sunny",
  "location": "San Francisco",
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

![API response with payment metadata](/docs/response-panel.png)

## Related

- [GitHub source](https://github.com/ds1/pincerpay/tree/master/examples/agent-weather)
- [Agent SDK Reference](/docs/agent-sdk)
- [Quickstart: Agent](/docs/quickstart-agent)
