import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import { merchants } from "@pincerpay/db";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../env.js";

export function createMerchantRoute(db: Database) {
  const app = new Hono<AppEnv>();

  app.get("/v1/merchant", async (c) => {
    const merchantId = c.get("merchantId");

    const [merchant] = await db
      .select({
        id: merchants.id,
        name: merchants.name,
        walletAddress: merchants.walletAddress,
        supportedChains: merchants.supportedChains,
        webhookUrlLive: merchants.webhookUrlLive,
        webhookUrlTest: merchants.webhookUrlTest,
        onChainRegistered: merchants.onChainRegistered,
        createdAt: merchants.createdAt,
      })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (!merchant) {
      return c.json({ error: "Merchant not found" }, 404);
    }

    return c.json(merchant);
  });

  return app;
}
