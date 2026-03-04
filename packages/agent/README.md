# @pincerpay/agent

[![npm](https://img.shields.io/npm/v/@pincerpay/agent?style=flat-square)](https://www.npmjs.com/package/@pincerpay/agent)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/agent?style=flat-square)](https://www.npmjs.com/package/@pincerpay/agent)
[![license](https://img.shields.io/npm/l/@pincerpay/agent?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Agent SDK for AI agents to pay for APIs using on-chain USDC via the x402 protocol.

> **ESM Required:** Your project must have `"type": "module"` in package.json. This package is ESM-only.

## Install

```bash
npm install @pincerpay/agent
```

## Quick Start

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

// Automatic 402 handling — pays and retries transparently
const response = await agent.fetch("https://api.example.com/weather");
const data = await response.json();
```

## API Reference

### `PincerPayAgent`

Wraps `fetch` with automatic x402 payment handling. When a request returns HTTP 402, the agent signs a USDC transfer and retries.

```typescript
class PincerPayAgent {
  static async create(config: AgentConfig): Promise<PincerPayAgent>;

  fetch(url: string | URL, init?: RequestInit): Promise<Response>;

  checkPolicy(amountBaseUnits: string): { allowed: boolean; reason?: string };
  setPolicy(policy: Partial<SpendingPolicy>): void;
  getDailySpend(): { date: string; amount: string };
  recordSpend(amountBaseUnits: string): void;

  get evmAddress(): string | undefined;
  get solanaAddress(): string | undefined;
  get chains(): string[];
}
```

### `SolanaSmartAgent`

Extended agent with Squads SPN smart account support and on-chain spending policies.

```typescript
class SolanaSmartAgent extends PincerPayAgent {
  static override async create(
    config: SolanaSmartAgentConfig
  ): Promise<SolanaSmartAgent>;

  get smartAccountPda(): string | undefined;
  get settingsPda(): string | undefined;
  get spendingLimitPda(): string | undefined;

  async settleDirectly(
    merchantId: string,
    amountBaseUnits: string,
    options?: { facilitatorUrl?: string; apiKey?: string; network?: string }
  ): Promise<{ success: boolean; transactionId?: string; error?: string }>;

  async checkOnChainPolicy(
    amountBaseUnits: string,
    rpcUrl?: string
  ): Promise<{ allowed: boolean; reason?: string; remainingAmount?: bigint }>;
}
```

### Config

```typescript
interface AgentConfig {
  chains: string[];                // ["solana", "base", "polygon"]
  evmPrivateKey?: string;          // Hex-encoded EVM key
  solanaPrivateKey?: string;       // Base58-encoded Solana keypair
  policies?: SpendingPolicy[];     // Client-side spending limits
  facilitatorUrl?: string;         // Default: https://facilitator.pincerpay.com
}

interface SpendingPolicy {
  maxPerTransaction?: string;      // Max USDC per transaction (base units)
  maxPerDay?: string;              // Max USDC per day (base units)
  allowedMerchants?: string[];     // Whitelist merchant addresses
  allowedChains?: string[];        // Whitelist chain shorthands
}

// USDC base units (6 decimals): $0.01 = "10000", $0.10 = "100000", $1.00 = "1000000"
// WARNING: Do NOT use human-readable amounts like "0.10" — BigInt("0.10") throws at runtime.
```

## Common Patterns

### Solana agent with spending limits

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "1000000", // 1 USDC max per tx
      maxPerDay: "10000000",        // 10 USDC max per day
    },
  ],
});
```

### Multi-chain agent (Solana + EVM)

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana", "base"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
});
```

### Direct settlement via Anchor program

```typescript
import { SolanaSmartAgent } from "@pincerpay/agent";

const agent = await SolanaSmartAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  smartAccountIndex: 0,
  spendingLimitIndex: 0,
});

const result = await agent.settleDirectly("merchant-uuid", "500000", {
  apiKey: process.env.PINCERPAY_API_KEY!,
});
```

### Runtime policy management

```typescript
// Pre-check if a payment would be allowed
const check = agent.checkPolicy("500000"); // 0.50 USDC
if (!check.allowed) console.log(check.reason);

// Update spending limits dynamically
agent.setPolicy({ maxPerTransaction: "5000000", maxPerDay: "50000000" });

// Monitor daily spending
const { date, amount } = agent.getDailySpend();
console.log(`Spent ${amount} base units on ${date}`);
```

## Anti-Patterns

### Don't expose agent private keys in client-side code

Agent keys should only be used in server-side or backend agent processes, never in browser environments.

### Don't skip spending policies in production

Without policies, an agent can spend unlimited USDC. Always set `maxPerDay` at minimum.

```typescript
// Bad — no limits
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: key,
});

// Good — bounded spending
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: key,
  policies: [{ maxPerDay: "10000000" }], // 10 USDC/day
});
```

### Don't use `PincerPayAgent` for merchant-side logic

The agent SDK is for making payments. Use `@pincerpay/merchant` for accepting payments.
