import { Hono, type Context } from "hono";
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { apiKeys, merchants } from "@pincerpay/db";
import type { Database, Environment } from "@pincerpay/db";
import { API_KEY_PREFIX_LENGTH } from "@pincerpay/core";
import type { AppEnv } from "../../env.js";
import { audit } from "../../lib/audit.js";
import { sha256Hex } from "../../lib/tokens.js";
import { createApiKeySchema, sessionIdParamSchema } from "./schemas.js";

const MAX_ACTIVE_KEYS_PER_MERCHANT = 50;

async function loadMerchantId(db: Database, authUserId: string) {
  const [row] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return row?.id ?? null;
}

function clientIp(c: Context<AppEnv>): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

function newApiKey(environment: Environment) {
  const prefixWord = environment === "test" ? "pp_test_" : "pp_live_";
  const rawKey = `${prefixWord}${randomBytes(32).toString("hex")}`;
  const keyHash = sha256Hex(rawKey);
  const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);
  return { rawKey, keyHash, prefix };
}

export function createApiKeysOnboardingRoute(db: Database) {
  const app = new Hono<AppEnv>();

  // ── Create ───────────────────────────────────────────────────────────────

  app.post("/v1/onboarding/api-keys", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const merchantId = await loadMerchantId(db, authUserId);
    if (!merchantId) {
      return c.json(
        { error: "merchant_not_found", message: "Bootstrap a merchant first." },
        404,
      );
    }

    // Cap active keys per merchant.
    const [activeCount] = await db
      .select({ n: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.merchantId, merchantId), eq(apiKeys.isActive, true)));
    if (activeCount.n >= MAX_ACTIVE_KEYS_PER_MERCHANT) {
      return c.json(
        {
          error: "active_key_limit_reached",
          limit: MAX_ACTIVE_KEYS_PER_MERCHANT,
          message: "Revoke unused keys before creating new ones.",
        },
        409,
      );
    }

    const environment: Environment = parsed.data.isTest ? "test" : "live";
    const { rawKey, keyHash, prefix } = newApiKey(environment);
    const [created] = await db
      .insert(apiKeys)
      .values({
        merchantId,
        keyHash,
        prefix,
        label: parsed.data.label,
        environment,
      })
      .returning({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        label: apiKeys.label,
        environment: apiKeys.environment,
        createdAt: apiKeys.createdAt,
      });

    await audit(db, {
      authUserId,
      merchantId,
      eventType: "api_key.created",
      metadata: {
        keyId: created.id,
        prefix: created.prefix,
        label: created.label,
        environment: created.environment,
        expiresAt: parsed.data.expiresAt ?? null,
      },
      clientIp: clientIp(c),
      clientName: c.req.header("user-agent") ?? "unknown",
    }, logger);

    return c.json({
      id: created.id,
      rawKey,
      prefix: created.prefix,
      label: created.label,
      environment: created.environment,
      createdAt: created.createdAt.toISOString(),
      expiresAt: parsed.data.expiresAt ?? null,
      message: "Save this key now. It is never shown again.",
    });
  });

  // ── List ─────────────────────────────────────────────────────────────────

  app.get("/v1/onboarding/api-keys", async (c) => {
    const authUserId = c.get("authUserId");
    const merchantId = await loadMerchantId(db, authUserId);
    if (!merchantId) {
      return c.json({ error: "merchant_not_found" }, 404);
    }

    const rows = await db
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        label: apiKeys.label,
        environment: apiKeys.environment,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.merchantId, merchantId));

    return c.json({
      keys: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      })),
    });
  });

  // ── Rotate (atomic mint + revoke) ───────────────────────────────────────

  app.post("/v1/onboarding/api-keys/:id/rotate", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const idParse = sessionIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!idParse.success) {
      return c.json({ error: "invalid_id", details: idParse.error.issues }, 400);
    }

    const merchantId = await loadMerchantId(db, authUserId);
    if (!merchantId) return c.json({ error: "merchant_not_found" }, 404);

    const [target] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, idParse.data.id), eq(apiKeys.merchantId, merchantId)))
      .limit(1);
    if (!target) return c.json({ error: "api_key_not_found" }, 404);

    // Rotation preserves environment: rotating a test key produces a test key.
    const { rawKey, keyHash, prefix } = newApiKey(target.environment);
    const [created] = await db
      .insert(apiKeys)
      .values({
        merchantId,
        keyHash,
        prefix,
        label: target.label,
        environment: target.environment,
      })
      .returning({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        label: apiKeys.label,
        environment: apiKeys.environment,
        createdAt: apiKeys.createdAt,
      });

    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, target.id));

    await audit(db, {
      authUserId,
      merchantId,
      eventType: "api_key.rotated",
      metadata: {
        oldKeyId: target.id,
        newKeyId: created.id,
        prefix: created.prefix,
        environment: created.environment,
      },
      clientIp: clientIp(c),
      clientName: c.req.header("user-agent") ?? "unknown",
    }, logger);

    return c.json({
      id: created.id,
      rawKey,
      prefix: created.prefix,
      label: created.label,
      environment: created.environment,
      createdAt: created.createdAt.toISOString(),
      revokedKeyId: target.id,
      message: "Save this key now. It is never shown again.",
    });
  });

  // ── Revoke ──────────────────────────────────────────────────────────────

  app.delete("/v1/onboarding/api-keys/:id", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const idParse = sessionIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!idParse.success) {
      return c.json({ error: "invalid_id", details: idParse.error.issues }, 400);
    }

    const merchantId = await loadMerchantId(db, authUserId);
    if (!merchantId) return c.json({ error: "merchant_not_found" }, 404);

    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, idParse.data.id), eq(apiKeys.merchantId, merchantId)))
      .returning({ id: apiKeys.id, prefix: apiKeys.prefix });

    if (!updated) return c.json({ error: "api_key_not_found" }, 404);

    await audit(db, {
      authUserId,
      merchantId,
      eventType: "api_key.revoked",
      metadata: { keyId: updated.id, prefix: updated.prefix },
      clientIp: clientIp(c),
      clientName: c.req.header("user-agent") ?? "unknown",
    }, logger);

    return c.json({ status: "revoked", id: updated.id });
  });

  return app;
}
