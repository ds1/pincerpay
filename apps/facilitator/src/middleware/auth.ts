import { type MiddlewareHandler } from "hono";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { API_KEY_HEADER } from "@pincerpay/core";
import { apiKeys, merchants } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";

/**
 * API key authentication middleware.
 * Validates the x-pincerpay-api-key header against hashed keys in the database.
 * Sets merchantId on the context for downstream handlers.
 */
export function authMiddleware(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const logger = c.get("logger");
    const apiKey = c.req.header(API_KEY_HEADER);
    if (!apiKey) {
      logger.warn({
        msg: "auth_missing_key",
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
        path: c.req.path,
      });
      return c.json({ error: "Missing API key" }, 401);
    }

    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyPrefix = apiKey.slice(0, 12);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!key) {
      logger.warn({
        msg: "auth_invalid_key",
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
        prefix: keyPrefix,
        path: c.req.path,
      });
      return c.json({ error: "Invalid API key" }, 401);
    }

    // Update last used timestamp (fire-and-forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .then(() => {})
      .catch(() => {});

    c.set("merchantId", key.merchantId);
    c.set("apiKeyId", key.id);
    c.set("environment", key.environment);

    // Look up merchant webhook config for downstream webhook dispatch.
    // Resolve to the env-appropriate URL/secret pair so test deliveries never
    // hit a live endpoint.
    try {
      const [merchant] = await db
        .select({
          webhookUrlLive: merchants.webhookUrlLive,
          webhookSecretLive: merchants.webhookSecretLive,
          webhookUrlTest: merchants.webhookUrlTest,
          webhookSecretTest: merchants.webhookSecretTest,
        })
        .from(merchants)
        .where(eq(merchants.id, key.merchantId))
        .limit(1);
      const webhookUrl = key.environment === "test" ? merchant?.webhookUrlTest : merchant?.webhookUrlLive;
      const webhookSecret = key.environment === "test" ? merchant?.webhookSecretTest : merchant?.webhookSecretLive;
      if (webhookUrl) c.set("webhookUrl", webhookUrl);
      if (webhookSecret) c.set("webhookSecret", webhookSecret);
    } catch {
      // Non-critical — webhook config lookup failure shouldn't block requests
    }

    await next();
  };
}
