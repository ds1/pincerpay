import { type MiddlewareHandler } from "hono";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cliSessions } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { parseToken } from "../lib/tokens.js";

function getClientIp(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

/**
 * CLI session authentication middleware.
 *
 * Validates `Authorization: Bearer pp_cli_*` against `cli_sessions`. Sets
 * `authUserId` and `cliSessionId` on the Hono context for downstream
 * handlers. Updates `last_used_at` and `client_ip_last` async (fire-and-forget
 * — does not block the request).
 *
 * Distinct from `authMiddleware` which validates `pp_live_*` API keys against
 * the `api_keys` table. Both can coexist — different routes, different scopes.
 */
export function cliAuthMiddleware(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const logger = c.get("logger");
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      return c.json({ error: "missing_bearer_token" }, 401);
    }
    const raw = header.slice("Bearer ".length).trim();

    const parsed = parseToken(raw);
    if (!parsed.ok || !parsed.hash) {
      logger.warn({
        msg: "cli_auth_malformed_token",
        reason: parsed.reason,
        path: c.req.path,
      });
      const message =
        parsed.reason === "checksum"
          ? "token_checksum_invalid"
          : "token_format_invalid";
      return c.json({ error: message }, 401);
    }

    const [session] = await db
      .select({
        id: cliSessions.id,
        authUserId: cliSessions.authUserId,
        expiresAt: cliSessions.expiresAt,
      })
      .from(cliSessions)
      .where(
        and(
          eq(cliSessions.tokenHash, parsed.hash),
          isNull(cliSessions.revokedAt),
        ),
      )
      .limit(1);

    if (!session) {
      logger.warn({
        msg: "cli_auth_session_not_found",
        prefix: parsed.prefix,
        path: c.req.path,
      });
      return c.json({ error: "session_not_found" }, 401);
    }

    if (session.expiresAt.getTime() < Date.now()) {
      // Auto-revoke expired sessions on next use.
      db.update(cliSessions)
        .set({ revokedAt: new Date(), revokedReason: "expired" })
        .where(eq(cliSessions.id, session.id))
        .catch(() => {});
      return c.json({ error: "session_expired" }, 401);
    }

    c.set("authUserId", session.authUserId);
    c.set("cliSessionId", session.id);

    const clientIp = getClientIp(c);
    db.update(cliSessions)
      .set({
        lastUsedAt: sql`NOW()`,
        ...(clientIp ? { clientIpLast: clientIp } : {}),
      })
      .where(eq(cliSessions.id, session.id))
      .catch(() => {});

    await next();
  };
}
