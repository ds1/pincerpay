import { type MiddlewareHandler } from "hono";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { API_KEY_HEADER } from "@pincerpay/core";
import { apiKeys } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";

/**
 * API key authentication middleware.
 * Validates the x-pincerpay-api-key header against hashed keys in the database.
 * Sets merchantId on the context for downstream handlers.
 */
export function authMiddleware(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const apiKey = c.req.header(API_KEY_HEADER);
    if (!apiKey) {
      return c.json({ error: "Missing API key" }, 401);
    }

    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!key) {
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

    await next();
  };
}
