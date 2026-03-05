# @pincerpay/solana

[![npm](https://img.shields.io/npm/v/@pincerpay/solana?style=flat-square)](https://www.npmjs.com/package/@pincerpay/solana)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/solana?style=flat-square)](https://www.npmjs.com/package/@pincerpay/solana)
[![license](https://img.shields.io/npm/l/@pincerpay/solana?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Solana infrastructure integrations for [PincerPay](https://pincerpay.com): Kora gasless transactions and Squads SPN smart accounts.

## Install

```bash
npm install @pincerpay/solana
```

## Kora (Gasless Transactions)

Agents pay transaction fees in USDC instead of SOL via [Kora](https://launch.solana.com/docs/kora/json-rpc-api) signer nodes.

### Quick Start

```typescript
import { createKoraClient, createKoraFacilitatorSvmSigner, parseKoraConfig } from "@pincerpay/solana/kora";

// Parse config from environment variables (KORA_RPC_URL, KORA_API_KEY)
const config = parseKoraConfig(process.env);

// Low-level client
const kora = createKoraClient({
  rpcUrl: "https://your-kora-node.example.com",
  apiKey: "optional-api-key",
});

const feePayer = await kora.getFeePayer();

// x402 facilitator integration
const signer = createKoraFacilitatorSvmSigner({
  config: { rpcUrl: "https://your-kora-node.example.com" },
  rpcUrls: { "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "https://api.devnet.solana.com" },
});

await signer.init(); // Fetches fee payer address from Kora node
```

### API Reference

```typescript
interface KoraConfig {
  rpcUrl: string;
  apiKey?: string;
}

function createKoraClient(config: KoraConfig): KoraRpcClient;

function createKoraFacilitatorSvmSigner(options: {
  config: KoraConfig;
  rpcUrls?: Record<string, string>;
}): FacilitatorSvmSigner & { init(): Promise<void> };

// Parse KORA_RPC_URL and KORA_API_KEY from env — returns null if no URL
function parseKoraConfig(env: Record<string, string | undefined>): KoraConfig | null;

// Zod schema for KoraConfig validation
const koraConfigSchema: z.ZodObject<{ rpcUrl: z.ZodString; apiKey: z.ZodOptional<z.ZodString> }>;
```

## Squads SPN (Smart Accounts)

Decentralized policy co-signer for agent sub-accounts with on-chain spending limits via the [Squads Protocol](https://squads.so).

### Quick Start

```typescript
import {
  deriveSmartAccountPda,
  createSpendingLimit,
  checkSpendingLimit,
  revokeSpendingLimit,
  SpendingLimitPeriod,
} from "@pincerpay/solana/squads";

// Derive smart account PDA
const [smartAccountPda] = await deriveSmartAccountPda(creatorAddress, 0);

// Create a daily spending limit
const ix = await createSpendingLimit(
  {
    smartAccountPda,
    mint: usdcMintAddress,
    amount: 10_000_000n, // 10 USDC
    period: SpendingLimitPeriod.Day,
    members: [agentAddress],
    destinations: [merchantAddress],
  },
  0, // spending limit index
  authorityAddress
);

// Check remaining allowance
const limit = await checkSpendingLimit(smartAccountPda, 0, rpcUrl);
// { exists: true, remainingAmount: 8_000_000n, period: "Day" }

// Revoke a spending limit
const revokeIx = await revokeSpendingLimit(smartAccountPda, 0, authorityAddress, rentCollectorAddress);
```

### API Reference

#### PDA Derivation

```typescript
async function deriveSmartAccountPda(
  creator: Address, accountIndex: number, programId?: Address
): Promise<[Address, number]>;

async function deriveSettingsPda(
  smartAccountPda: Address, programId?: Address
): Promise<[Address, number]>;

async function deriveSpendingLimitPda(
  smartAccountPda: Address, spendingLimitIndex: number, programId?: Address
): Promise<[Address, number]>;
```

#### High-Level Spending Limit Management

```typescript
async function createSpendingLimit(
  config: SpendingLimitConfig, spendingLimitIndex: number, authority: Address
): Promise<Instruction>;

async function checkSpendingLimit(
  smartAccountPda: Address, spendingLimitIndex: number, rpcUrl: string
): Promise<{ exists: boolean; remainingAmount?: bigint; period?: SpendingLimitPeriod } | null>;

async function revokeSpendingLimit(
  smartAccountPda: Address, spendingLimitIndex: number, authority: Address, rentCollector: Address
): Promise<Instruction>;
```

#### Low-Level Instruction Builders

For fine-grained control over transaction construction:

```typescript
// Create a new Squads Smart Account
function createSmartAccountInstruction(config: SmartAccountConfig): Promise<Instruction>;

// Add a spending limit to an existing Smart Account
function addSpendingLimitInstruction(
  config: SpendingLimitConfig, spendingLimitIndex: number, authority: Address
): Promise<Instruction>;

// Use (decrement) a spending limit
function useSpendingLimitInstruction(...): Promise<Instruction>;

// Remove a spending limit and reclaim rent
function removeSpendingLimitInstruction(params: {
  smartAccountPda: Address;
  spendingLimitIndex: number;
  authority: Address;
  rentCollector: Address;
}): Promise<Instruction>;
```

#### Types

```typescript
enum SpendingLimitPeriod {
  OneTime = 0,
  Day = 1,
  Week = 2,
  Month = 3,
}

interface SpendingLimitConfig {
  smartAccountPda: Address;
  mint: Address;
  amount: bigint;
  period: SpendingLimitPeriod;
  members: Address[];
  destinations: Address[];
}

interface SmartAccountConfig {
  creator: Address;
  accountIndex: number;
  members: Address[];
  threshold: number;
}

const SQUADS_PROGRAM_ID = "SMRTzfY6DfH5ik3TKiyLFfXexV8uSG3d2UksSCYdunG";
```

## Common Patterns

### Kora + Squads together

```typescript
import { createKoraFacilitatorSvmSigner } from "@pincerpay/solana/kora";
import { deriveSmartAccountPda, checkSpendingLimit } from "@pincerpay/solana/squads";

// Agent pays gas in USDC (Kora) + has on-chain spending limits (Squads)
const signer = createKoraFacilitatorSvmSigner({ config: koraConfig });
const [smartAccount] = await deriveSmartAccountPda(creator, 0);
const limit = await checkSpendingLimit(smartAccount, 0, rpcUrl);
```

### Parse Kora config from environment

```typescript
import { parseKoraConfig } from "@pincerpay/solana/kora";

const config = parseKoraConfig(process.env);
if (config) {
  console.log("Kora enabled:", config.rpcUrl);
} else {
  console.log("Kora not configured, using local keypair for gas");
}
```

## Anti-Patterns

### Don't skip `signer.init()` for Kora

The Kora signer must call `init()` before use -- it fetches the fee payer address from the Kora node.

### Don't use Squads on EVM

Squads SPN is Solana-only. For EVM agent permissions, use ERC-7715 session keys instead.
