# @pincerpay/core

[![npm](https://img.shields.io/npm/v/@pincerpay/core?style=flat-square)](https://www.npmjs.com/package/@pincerpay/core)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/core?style=flat-square)](https://www.npmjs.com/package/@pincerpay/core)
[![license](https://img.shields.io/npm/l/@pincerpay/core?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Shared types, chain configurations, and constants for the [PincerPay](https://pincerpay.com) ecosystem -- on-chain USDC payments for AI agents via the x402 protocol.

## Install

```bash
npm install @pincerpay/core
```

## Quick Start

```typescript
import { resolveChain, toCAIP2, DEFAULT_FACILITATOR_URL } from "@pincerpay/core";
import type { ChainConfig, Transaction, AgentProfile } from "@pincerpay/core/types";

const chain = resolveChain("solana");
// { caip2Id: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", name: "Solana Devnet", ... }

const caip2 = toCAIP2("base");
// "eip155:8453"
```

## API Reference

### Chain Resolution

```typescript
function resolveChain(input: string): ChainConfig | undefined;
function toCAIP2(shorthand: string): string;
function getMainnetChains(): ChainConfig[];
function getTestnetChains(): ChainConfig[];
```

### Chain Config

```typescript
interface ChainConfig {
  caip2Id: string;           // CAIP-2 identifier
  shorthand: string;         // "solana", "base", "polygon"
  name: string;              // Display name
  namespace: "eip155" | "solana";
  chainId?: number;          // EVM only
  usdcAddress: string;       // USDC token address
  usdcDecimals: number;      // Always 6
  rpcUrl: string;            // Default public RPC
  testnet: boolean;
  explorerUrl: string;
  blockTimeMs: number;
}
```

### Constants

```typescript
const DEFAULT_FACILITATOR_URL = "https://facilitator.pincerpay.com";
const API_VERSION = "v1";
const USDC_DECIMALS = 6;
const OPTIMISTIC_THRESHOLD = "1000000"; // 1 USDC
const API_KEY_HEADER = "x-pincerpay-api-key";
const API_KEY_PREFIX_LENGTH = 12;

const RATE_LIMIT = {
  perMinute: 120,
  perSecond: 20,
};

const TX_POLL_INTERVAL_MS = 2000;
const TX_CONFIRMATION_TIMEOUT_MS = 120_000;

const FACILITATOR_ROUTES = {
  verify: "/v1/verify",
  settle: "/v1/settle",
  status: "/v1/status",
  supported: "/v1/supported",
  health: "/health",
  metrics: "/v1/metrics",
  paywalls: "/v1/paywalls",
  transactions: "/v1/transactions",
  agents: "/v1/agents",
  webhooks: "/v1/webhooks",
  merchant: "/v1/merchant",
};
```

### Key Types

```typescript
type ChainNamespace = "eip155" | "solana";
type TransactionStatus = "pending" | "mempool" | "optimistic" | "confirmed" | "failed";
type SettlementType = "x402" | "direct";
type AgentStatus = "active" | "paused" | "revoked";

interface PincerPayConfig {
  apiKey: string;
  merchantAddress: string;
  facilitatorUrl?: string;
  routes: Record<string, RoutePaywallConfig>;
  /** Defer facilitator sync to first request instead of middleware init (default: false).
   *  Useful in Next.js to avoid build-time network calls during prerendering. */
  syncFacilitatorOnStart?: boolean;
}

interface AgentConfig {
  chains: string[];
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
  policies?: SpendingPolicy[];
  facilitatorUrl?: string;
}

interface SpendingPolicy {
  maxPerTransaction?: string;  // Base units (e.g., "1000000" = 1 USDC)
  maxPerDay?: string;
  allowedMerchants?: string[];
  allowedChains?: string[];
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  merchantId: string;
  chainId: string;               // CAIP-2
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;                // USDC base units
  gasCost: string;               // Base units of gasToken
  gasToken: string;              // "ETH" | "SOL" | "MATIC" | "USDC"
  status: TransactionStatus;
  optimistic: boolean;
  settlementType?: SettlementType; // "x402" or "direct" (Anchor program)
  programNonce?: string;         // On-chain settlement nonce
  slot?: string;                 // Solana slot number
  priorityFee?: string;          // Solana priority fee (microlamports)
  computeUnits?: string;         // Solana compute units consumed
  createdAt: Date;
  confirmedAt?: Date;
}
```

### Agent Profile

```typescript
interface AgentProfile {
  id: string;
  merchantId: string;
  name: string;
  solanaAddress: string;
  smartAccountPda?: string;      // Squads Smart Account PDA
  settingsPda?: string;
  spendingLimitPda?: string;
  maxPerTransaction?: string;    // USDC base units
  maxPerDay?: string;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### Zod Schemas

Validation schemas for use at system boundaries:

```typescript
import { PincerPayConfigSchema, SpendingPolicySchema, RoutePaywallConfigSchema } from "@pincerpay/core";

const result = PincerPayConfigSchema.safeParse(userInput);
```

### Supported Chains

| Chain | CAIP-2 ID | Shorthand | Testnet |
|---|---|---|---|
| Base | `eip155:8453` | `base` | No |
| Base Sepolia | `eip155:84532` | `base-sepolia` | Yes |
| Polygon | `eip155:137` | `polygon` | No |
| Polygon Amoy | `eip155:80002` | `polygon-amoy` | Yes |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `solana` | No |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `solana-devnet` | Yes |

## Sub-path Exports

```typescript
import { ... } from "@pincerpay/core";        // Everything
import type { ... } from "@pincerpay/core/types";  // Types only
import { resolveChain } from "@pincerpay/core/chains"; // Chain resolution only
```

## Common Patterns

### Resolve chain by shorthand or CAIP-2 ID

```typescript
import { resolveChain } from "@pincerpay/core";

resolveChain("solana");                                  // by shorthand
resolveChain("eip155:8453");                             // by CAIP-2 ID
resolveChain("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"); // by full CAIP-2
```

### Type-safe transaction handling

```typescript
import type { TransactionStatus } from "@pincerpay/core/types";

function handleStatus(status: TransactionStatus) {
  switch (status) {
    case "optimistic": return "Payment accepted (fast)";
    case "confirmed":  return "Payment confirmed on-chain";
    case "failed":     return "Payment failed";
    default:           return "Processing...";
  }
}
```

## Anti-Patterns

### Don't hardcode CAIP-2 IDs

Use `toCAIP2()` or `resolveChain()` instead of hardcoding chain identifiers.

```typescript
// Bad
const network = "eip155:8453";

// Good
import { toCAIP2 } from "@pincerpay/core";
const network = toCAIP2("base");
```

### Don't assume USDC decimals

Always use `USDC_DECIMALS` or `chain.usdcDecimals` instead of hardcoding `6`.
