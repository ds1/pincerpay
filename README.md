# PincerPay

On-chain USDC payment gateway for AI agents. No card rails. Instant settlement. Every chain.

## Architecture

```
Agent → 402 Challenge → Sign USDC Transfer → PincerPay Facilitator → Blockchain → Merchant
```

PincerPay is a non-custodial x402 facilitator. When an AI agent hits a merchant API and gets HTTP 402, the agent signs a USDC transfer. PincerPay verifies the signature, broadcasts to the blockchain, and confirms settlement.

## Monorepo Structure

| Package | Description |
|---|---|
| `apps/facilitator` | x402 facilitator service (Hono + Node.js) |
| `apps/dashboard` | Merchant dashboard (Next.js 15) |
| `packages/core` | Shared types, chain configs, constants |
| `packages/db` | Drizzle ORM schema + migrations |
| `packages/merchant` | Merchant SDK (`@pincerpay/merchant`) |
| `packages/agent` | Agent SDK (`@pincerpay/agent`) |
| `examples/` | Example merchant and agent apps |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL (Supabase recommended)

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Development

```bash
# Start all services
pnpm dev

# Start individual services
pnpm --filter @pincerpay/facilitator dev
pnpm --filter @pincerpay/dashboard dev
```

### Database

```bash
# Generate migrations from schema
pnpm db:generate

# Push schema to database
pnpm db:push
```

## Merchant SDK

```typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "0xYourAddress",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "base",
        description: "Weather data",
      },
    },
  })
);
```

## Agent SDK

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = new PincerPayAgent({
  chains: ["base"],
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
});

// Automatic 402 handling
const response = await agent.fetch("https://api.example.com/weather");
```

## Supported Chains

| Chain | Network ID | Status |
|---|---|---|
| Base | eip155:8453 | Mainnet |
| Base Sepolia | eip155:84532 | Testnet |
| Polygon | eip155:137 | Mainnet |
| Polygon Amoy | eip155:80002 | Testnet |
| Solana | solana:mainnet | Planned |

## Tech Stack

- **Runtime:** Node.js 22 (pnpm monorepo + Turborepo)
- **Facilitator:** Hono + @x402/core + @x402/evm + viem
- **Dashboard:** Next.js 15 + Tailwind CSS + Supabase Auth
- **Database:** PostgreSQL (Supabase) + Drizzle ORM
- **Protocols:** x402 (Coinbase), AP2 (Phase 2), UCP (Phase 2)

## License

MIT
