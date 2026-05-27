import { parseArgs } from "node:util";
import { and, eq, isNull, lt } from "drizzle-orm";
import { createDb, apiKeys, auditEvents } from "@pincerpay/db";

/**
 * #124 cutover cleanup. Revokes any still-active API key that was minted with
 * the legacy SHA-256 scheme (i.e. `key_hash_hmac IS NULL`) and is older than
 * the cutover window. New keys carry an HMAC hash, so after a long enough
 * migration window every legitimately-used key has been rotated to HMAC; the
 * stragglers revoked here are stale credentials.
 *
 * Run AFTER the HMAC-minting code has been deployed for the full window
 * (default 60 days). Always do a --dry-run first.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm tsx apps/facilitator/scripts/api-keys-migrate-cleanup.mts [--days 60] [--dry-run]
 */

const DEFAULT_WINDOW_DAYS = 60;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      days: { type: "string", default: String(DEFAULT_WINDOW_DAYS) },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set");

  const days = Number(values.days);
  if (!Number.isFinite(days) || days < 0) fail(`--days must be a non-negative number, got "${values.days}"`);
  const dryRun = values["dry-run"] ?? false;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { db, close } = createDb(url);

  try {
    // Legacy = active key with no HMAC hash, created before the cutoff.
    const stale = await db
      .select({
        id: apiKeys.id,
        merchantId: apiKeys.merchantId,
        prefix: apiKeys.prefix,
        environment: apiKeys.environment,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.isActive, true),
          isNull(apiKeys.keyHashHmac),
          lt(apiKeys.createdAt, cutoff),
        ),
      );

    console.log(
      `Found ${stale.length} active SHA-256-only key(s) created before ${cutoff.toISOString()} (window: ${days}d).`,
    );

    for (const key of stale) {
      console.log(`  ${key.prefix}…  env=${key.environment}  created=${key.createdAt.toISOString()}  merchant=${key.merchantId}`);
    }

    if (stale.length === 0) {
      console.log("Nothing to revoke.");
      return;
    }

    if (dryRun) {
      console.log("[dry-run] no changes written.");
      return;
    }

    for (const key of stale) {
      await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, key.id));
      await db.insert(auditEvents).values({
        merchantId: key.merchantId,
        eventType: "api_key.revoked",
        metadata: {
          keyId: key.id,
          prefix: key.prefix,
          reason: "sha256_cutover",
          migration: "#124",
        },
        clientName: "api-keys-migrate-cleanup",
      });
    }

    console.log(`Revoked ${stale.length} legacy key(s) and wrote audit events.`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
