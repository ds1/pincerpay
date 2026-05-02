import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { merchants } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../../env.js";

/**
 * Authenticated health / whoami endpoint. CLI uses this to:
 *   - Verify a stored token is still valid (cheap precheck before user-visible
 *     commands).
 *   - Render `pincerpay whoami` without making multiple round trips.
 */
export function createOnboardingHealthRoute(db: Database) {
  const app = new Hono<AppEnv>();

  app.get("/v1/onboarding/health", async (c) => {
    const authUserId = c.get("authUserId");
    const cliSessionId = c.get("cliSessionId");

    const [merchant] = await db
      .select({
        id: merchants.id,
        name: merchants.name,
        walletAddress: merchants.walletAddress,
        supportedChains: merchants.supportedChains,
      })
      .from(merchants)
      .where(eq(merchants.authUserId, authUserId))
      .limit(1);

    return c.json({
      ok: true,
      authUserId,
      cliSessionId,
      scope: "merchant:* api-keys:*",
      merchant: merchant
        ? {
            id: merchant.id,
            name: merchant.name,
            walletAddress: merchant.walletAddress,
            supportedChains: merchant.supportedChains,
          }
        : null,
    });
  });

  return app;
}
