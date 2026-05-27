# @pincerpay/db

Drizzle ORM schema and database client for PincerPay's PostgreSQL database.

## Install

```bash
npm install @pincerpay/db
```

## Quick Start

```typescript
import { createDb } from "@pincerpay/db";
import { merchants, transactions } from "@pincerpay/db";
import { eq } from "drizzle-orm";

const { db, close } = createDb(process.env.DATABASE_URL!);

// Query transactions for a merchant
const txs = await db
  .select()
  .from(transactions)
  .where(eq(transactions.merchantId, "merchant-uuid"))
  .limit(10);

// Clean up
await close();
```

## API Reference

### `createDb(connectionString, options?)`

Creates a Drizzle ORM client connected to PostgreSQL.

```typescript
function createDb(
  connectionString: string,
  options?: { serverless?: boolean }
): { db: Database; close: () => void };
```

- `serverless: true` - uses connection pooling suitable for serverless environments (Vercel)
- Returns a `close()` function to cleanly shut down the connection

### Schema Tables

#### `merchants`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Merchant display name |
| `walletAddress` | string | USDC receive address |
| `supportedChains` | string[] | CAIP-2 chain IDs |
| `webhookUrl` | string? | Webhook endpoint for payment events |
| `authUserId` | string | Supabase auth user ID (unique) |
| `onChainRegistered` | boolean | Whether registered on Anchor program |
| `merchantPda` | string? | Solana PDA address |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### `apiKeys`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `merchantId` | UUID | FK → merchants |
| `keyHash` | string? | Legacy SHA-256 hash (unique). Null for keys minted with HMAC; see [API key hashing](#api-key-hashing) |
| `keyHashHmac` | string? | HMAC-SHA256(`TOKEN_PEPPER`, key) (unique). Null for legacy keys |
| `prefix` | string | First 12 chars for identification |
| `label` | string | Human-readable label |
| `isActive` | boolean | |
| `environment` | enum | `live` or `test` - a `test` key cannot settle on a mainnet chain |
| `createdAt` | timestamp | |
| `lastUsedAt` | timestamp? | Updated on each API call |

#### `transactions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `merchantId` | UUID | FK → merchants |
| `chainId` | string | CAIP-2 network ID |
| `txHash` | string | Blockchain transaction hash |
| `fromAddress` | string | Payer (agent) address |
| `toAddress` | string | Receiver (merchant) address |
| `amount` | string | USDC in base units |
| `gasCost` | string | Fee in gasToken base units |
| `gasToken` | string | "SOL", "USDC", "ETH", "MATIC" |
| `status` | string | pending/mempool/optimistic/confirmed/failed |
| `optimistic` | boolean | Sub-1 USDC fast release |
| `settlementType` | string | "x402" or "direct" |
| `agentId` | UUID? | FK → agents |
| `endpoint` | string? | API endpoint that triggered payment |
| `slot` | string? | Solana slot number |
| `createdAt` | timestamp | |
| `confirmedAt` | timestamp? | |

#### `agents`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `merchantId` | UUID | FK → merchants |
| `name` | string | Display name |
| `solanaAddress` | string | Agent's Solana address |
| `smartAccountPda` | string? | Squads smart account |
| `maxPerTransaction` | string? | Spending limit per tx |
| `maxPerDay` | string? | Daily spending limit |
| `status` | string | active/paused/revoked |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

## API key hashing

`pp_live_*` / `pp_test_*` API keys are stored hashed, never in plaintext. Use the
shared helpers so every minting/verification site stays consistent:

```typescript
import { hashNewApiKey, apiKeyHashHmac, apiKeyHashSha256, getApiKeyPepper } from "@pincerpay/db";

// Mint: hashes with HMAC when TOKEN_PEPPER is set, else legacy SHA-256.
const { keyHash, keyHashHmac } = hashNewApiKey(rawKey);
await db.insert(apiKeys).values({ merchantId, keyHash, keyHashHmac, prefix, label, environment });

// Verify: try HMAC first, fall back to legacy SHA-256.
const pepper = getApiKeyPepper();           // string | null
const row = pepper
  ? await findByHmac(apiKeyHashHmac(rawKey, pepper)) ?? await findBySha256(apiKeyHashSha256(rawKey))
  : await findBySha256(apiKeyHashSha256(rawKey));
```

- **`TOKEN_PEPPER`** - server pepper (min 32 chars), the same value used for `cli_sessions`.
  Every service that mints keys (facilitator, dashboard, CLI/bootstrap scripts) must share the
  **byte-for-byte identical** pepper, or HMAC lookups won't match. When unset, helpers fall back to
  legacy SHA-256 so key creation never hard-fails.
- **Migration `0004`** adds the nullable `key_hash_hmac` column and makes `key_hash` nullable. New
  keys store one or the other; verification accepts both during the migration window.
- **Cutover** - once every minting service has the pepper and enough time has passed,
  `apps/facilitator/scripts/api-keys-migrate-cleanup.mts` revokes the leftover SHA-256-only keys
  (`--dry-run` first; default 60-day window) and writes an audit event per revocation.

## Common Patterns

### Query with Drizzle operators

```typescript
import { eq, and, gte, desc } from "drizzle-orm";
import { transactions } from "@pincerpay/db";

// Recent confirmed transactions
const confirmed = await db
  .select()
  .from(transactions)
  .where(
    and(
      eq(transactions.merchantId, merchantId),
      eq(transactions.status, "confirmed"),
      gte(transactions.createdAt, new Date(Date.now() - 86400_000))
    )
  )
  .orderBy(desc(transactions.createdAt));
```

### Insert a transaction

```typescript
import { transactions } from "@pincerpay/db";

await db.insert(transactions).values({
  merchantId: "uuid",
  chainId: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  txHash: "5abc...",
  fromAddress: "agent-address",
  toAddress: "merchant-address",
  amount: "1000000",
  gasToken: "SOL",
  status: "confirmed",
  optimistic: false,
});
```

## Anti-Patterns

### Don't bypass Drizzle for raw SQL unless necessary

Drizzle provides type-safe queries. Use `db.execute(sql`...`)` only for operations Drizzle doesn't support (e.g., `SELECT 1` health checks).

### Don't forget to close the connection

Always call `close()` when the process shuts down, especially in serverless environments.

### Don't run `db:push` in production without re-enabling RLS

`drizzle-kit push` recreates tables without RLS policies. After every push, re-enable RLS on all tables.
