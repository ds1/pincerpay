---
title: "Database & Key Hashing Functions"
description: "Implementation guide to @pincerpay/db - the connection factory, the API-key hashing helpers, and the TOKEN_PEPPER rule that keeps keys verifiable across services."
order: 3.95
section: SDK Guides
---

`@pincerpay/db` is the Drizzle ORM schema and Postgres client behind PincerPay. Most teams consume it indirectly (via the facilitator, dashboard, or `@pincerpay/onboarding`), but its connection factory and - new in 0.3.0 - its API-key hashing helpers are the canonical building blocks for anything that touches merchants, keys, or transactions directly. This guide covers each, plus the cross-service `TOKEN_PEPPER` contract.

> **ESM-only, server-side.** It uses the Node `postgres` driver and `node:crypto`; it never belongs in a browser bundle. Two entry points: `@pincerpay/db` (client + hashing + schema) and `@pincerpay/db/schema` (schema only).

## `createDb(connectionString, options?)` - the connection factory

```ts
import { createDb, transactions } from "@pincerpay/db";
import { eq } from "drizzle-orm";

const { db, close } = createDb(process.env.DATABASE_URL!);
try {
  const rows = await db.select().from(transactions)
    .where(eq(transactions.merchantId, id)).limit(10);
} finally {
  await close(); // ALWAYS close - especially in serverless
}
```

Returns `{ db, close }` where `db` is a Drizzle instance bound to the full schema and `close()` ends the underlying pool. The `Database` type is exported for typing functions that accept the client (`db: Database`).

It adapts to your connection automatically:

- `{ serverless: true }` caps the pool at `max: 1` (right for Vercel/Lambda); the default is `max: 10`.
- **Pooler detection:** if the connection string contains `:6543` (Supabase's transaction pooler) it disables prepared statements (`prepare: false`) and requires TLS (`ssl: "require"`). A direct `:5432` connection uses `prepare: true`, `ssl: false`. So point serverless code at the `:6543` pooler URL and long-lived services at `:5432` - `createDb` does the rest.

The one rule: **call `close()`** when you're done (or on shutdown). Leaked pools are the classic serverless failure.

## API-key hashing helpers

API keys are never stored in plaintext. As of migration `0004`, PincerPay hashes them with **HMAC-SHA256 + a server pepper** (matching `cli_sessions`), with a legacy SHA-256 path for backward compatibility. Use these helpers at every mint and verify site so the scheme stays consistent - don't re-implement hashing inline.

### Minting

```ts
import { hashNewApiKey, apiKeys } from "@pincerpay/db";

const { keyHash, keyHashHmac } = hashNewApiKey(rawKey); // reads TOKEN_PEPPER from env
await db.insert(apiKeys).values({ merchantId, keyHash, keyHashHmac, prefix, label, environment });
```

`hashNewApiKey(rawKey, env?)` returns a `MintedApiKeyHash` with **exactly one** column populated: if a pepper is available it returns `{ keyHashHmac: <hmac>, keyHash: null }`; otherwise it falls back to `{ keyHashHmac: null, keyHash: <sha256> }`. The fallback means key creation never hard-fails just because a pepper isn't configured - but a fallback key is a legacy SHA-256 key.

### Verifying

```ts
import { apiKeyHashHmac, apiKeyHashSha256, getApiKeyPepper, apiKeys } from "@pincerpay/db";
import { and, eq } from "drizzle-orm";

const pepper = getApiKeyPepper();          // string | null
let row;
if (pepper) {
  [row] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHashHmac, apiKeyHashHmac(rawKey, pepper)), eq(apiKeys.isActive, true))).limit(1);
}
if (!row) {
  [row] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, apiKeyHashSha256(rawKey)), eq(apiKeys.isActive, true))).limit(1);
}
```

Verify **HMAC first, then fall back to SHA-256** so keys minted before the migration keep working through the cutover window. This is exactly what the facilitator's auth middleware does.

- `apiKeyHashHmac(rawKey, pepper)` → `HMAC-SHA256(pepper, rawKey)` hex. For new keys.
- `apiKeyHashSha256(rawKey)` → legacy plain `SHA-256(rawKey)` hex. Fallback only.
- `getApiKeyPepper(env?)` → returns `env.TOKEN_PEPPER`, or `null` if it's unset **or shorter than 32 characters**.

### The TOKEN_PEPPER contract

`TOKEN_PEPPER` is a server secret (≥ 32 chars) shared with `cli_sessions`. The critical operational rule: **every service that mints API keys - the facilitator, the dashboard, and any CLI/bootstrap script - must use the byte-for-byte identical `TOKEN_PEPPER`.** A key HMAC'd with one pepper will not match a lookup computed with a different one, so a mismatched dashboard would mint keys the facilitator rejects. When the pepper is absent everywhere, everything degrades gracefully to SHA-256.

Once the pepper is deployed everywhere and the migration window has passed, `apps/facilitator/scripts/api-keys-migrate-cleanup.mts` revokes the leftover SHA-256-only keys (dry-run first; default 60-day window) and writes an audit event per revocation.

## Schema exports

The package exports Drizzle table objects you query/insert against: `merchants`, `apiKeys`, `paywalls`, `transactions`, `agents`, `webhookDeliveries`, `complianceEvents`, `cliSessions`, `auditEvents` - plus `environmentEnum` and its `Environment` (`"live" | "test"`) type. See the [`@pincerpay/db` README](https://github.com/ds1/pincerpay/tree/master/packages/db) for column-level detail.

> **After `db:push`, re-enable RLS.** `drizzle-kit push` recreates tables without RLS policies; PincerPay's security model relies on RLS being on. Re-apply it after any push.

## Where next

The [Onboarding guide](/docs/guide-onboarding) mints keys through `hashNewApiKey`, and the [error reference](/docs/error-reference) documents the auth lookup from the agent's perspective.
