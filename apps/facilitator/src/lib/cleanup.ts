import { lt, sql } from "drizzle-orm";
import type { Database } from "@pincerpay/db";
import { cliSessions } from "@pincerpay/db";
import { cleanupBuckets } from "./rate-limit.js";

export interface CleanupHandle {
  stop(): void;
}

/**
 * Periodic cleanup of stale state:
 *
 *   - Deletes cli_sessions revoked > 30 days ago (audit trail kept for 30d).
 *   - Deletes cli_sessions expired > 30 days ago.
 *   - Drops in-memory rate-limit buckets that have rolled over.
 *
 * Runs every 10 minutes. Best-effort — failures are logged, never throw.
 */
export function startCleanup(
  db: Database,
  logger: { info: (obj: object) => void; warn: (obj: object) => void },
  intervalMs = 10 * 60 * 1000,
): CleanupHandle {
  const tick = async () => {
    try {
      const cutoff = sql`NOW() - interval '30 days'`;

      const revokedResult = await db
        .delete(cliSessions)
        .where(sql`${cliSessions.revokedAt} IS NOT NULL AND ${cliSessions.revokedAt} < ${cutoff}`);

      const expiredResult = await db
        .delete(cliSessions)
        .where(lt(cliSessions.expiresAt, sql`NOW() - interval '30 days'`));

      cleanupBuckets();

      logger.info({
        msg: "cleanup_tick",
        revokedDeleted: (revokedResult as { rowCount?: number }).rowCount ?? 0,
        expiredDeleted: (expiredResult as { rowCount?: number }).rowCount ?? 0,
      });
    } catch (err) {
      logger.warn({
        msg: "cleanup_tick_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Run once shortly after startup, then on the regular interval.
  const initialTimer = setTimeout(tick, 30_000);
  const intervalTimer = setInterval(tick, intervalMs);

  return {
    stop() {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    },
  };
}
