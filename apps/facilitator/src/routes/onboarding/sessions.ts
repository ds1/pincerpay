import { Hono, type Context } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cliSessions } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../../env.js";
import { audit } from "../../lib/audit.js";
import { sessionIdParamSchema } from "./schemas.js";

function clientIp(c: Context<AppEnv>): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

export function createSessionsOnboardingRoute(db: Database) {
  const app = new Hono<AppEnv>();

  // ── List active sessions for the current user ──────────────────────────

  app.get("/v1/onboarding/sessions", async (c) => {
    const authUserId = c.get("authUserId");
    const currentSessionId = c.get("cliSessionId");

    const rows = await db
      .select({
        id: cliSessions.id,
        prefix: cliSessions.prefix,
        label: cliSessions.label,
        clientName: cliSessions.clientName,
        clientIpFirst: cliSessions.clientIpFirst,
        clientIpLast: cliSessions.clientIpLast,
        createdAt: cliSessions.createdAt,
        lastUsedAt: cliSessions.lastUsedAt,
        expiresAt: cliSessions.expiresAt,
      })
      .from(cliSessions)
      .where(
        and(eq(cliSessions.authUserId, authUserId), isNull(cliSessions.revokedAt)),
      )
      .orderBy(desc(cliSessions.createdAt));

    return c.json({
      sessions: rows.map((r) => ({
        ...r,
        isCurrent: r.id === currentSessionId,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt.toISOString(),
      })),
    });
  });

  // ── Revoke the current session (used by `pincerpay logout`) ────────────

  app.delete("/v1/onboarding/sessions/me", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const cliSessionId = c.get("cliSessionId");

    await db
      .update(cliSessions)
      .set({ revokedAt: new Date(), revokedReason: "user" })
      .where(eq(cliSessions.id, cliSessionId));

    await audit(db, {
      authUserId,
      eventType: "cli_session.revoked",
      metadata: { sessionId: cliSessionId, scope: "self" },
      clientIp: clientIp(c),
      clientName: c.req.header("user-agent") ?? "unknown",
    }, logger);

    return c.json({ status: "revoked", id: cliSessionId });
  });

  // ── Revoke any session by id (current user only) ──────────────────────

  app.delete("/v1/onboarding/sessions/:id", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const idParse = sessionIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!idParse.success) {
      return c.json({ error: "invalid_id", details: idParse.error.issues }, 400);
    }

    const [updated] = await db
      .update(cliSessions)
      .set({ revokedAt: new Date(), revokedReason: "user" })
      .where(
        and(
          eq(cliSessions.id, idParse.data.id),
          eq(cliSessions.authUserId, authUserId),
          isNull(cliSessions.revokedAt),
        ),
      )
      .returning({ id: cliSessions.id, prefix: cliSessions.prefix });

    if (!updated) return c.json({ error: "session_not_found" }, 404);

    await audit(db, {
      authUserId,
      eventType: "cli_session.revoked",
      metadata: { sessionId: updated.id, prefix: updated.prefix, scope: "by_id" },
      clientIp: clientIp(c),
      clientName: c.req.header("user-agent") ?? "unknown",
    }, logger);

    return c.json({ status: "revoked", id: updated.id });
  });

  return app;
}
