import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import { webhookDeliveries } from "@pincerpay/db";
import { eq, and, count, desc } from "drizzle-orm";
import type { AppEnv } from "../env.js";
import { webhookFilterSchema } from "./schemas.js";
import { RETRY_QUEUE_STATUS } from "../webhooks/dispatcher.js";

export function createWebhookRoutes(db: Database) {
  const app = new Hono<AppEnv>();

  // List webhook deliveries
  app.get("/v1/webhooks", async (c) => {
    const merchantId = c.get("merchantId");
    const query = webhookFilterSchema.safeParse(c.req.query());

    if (!query.success) {
      return c.json({ error: "Invalid query parameters", details: query.error.issues }, 400);
    }

    const { limit, offset, status, event } = query.data;
    const conditions = [eq(webhookDeliveries.merchantId, merchantId)];
    if (status) conditions.push(eq(webhookDeliveries.status, status));
    if (event) conditions.push(eq(webhookDeliveries.event, event));

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(webhookDeliveries)
        .where(where)
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(webhookDeliveries)
        .where(where),
    ]);

    return c.json({ items, total, limit, offset });
  });

  // Retry a webhook delivery
  app.post("/v1/webhooks/:id/retry", async (c) => {
    const merchantId = c.get("merchantId");
    const id = c.req.param("id");

    // Find the webhook delivery
    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.merchantId, merchantId),
        ),
      )
      .limit(1);

    if (!delivery) {
      return c.json({ error: "Webhook delivery not found" }, 404);
    }

    if (delivery.status === "delivered") {
      return c.json({ error: "Webhook already delivered successfully" }, 409);
    }

    // Re-queue on the status the retry worker polls, due now
    await db
      .update(webhookDeliveries)
      .set({
        status: RETRY_QUEUE_STATUS,
        nextRetryAt: new Date(),
        lastError: null,
      })
      .where(eq(webhookDeliveries.id, id));

    return c.json({ success: true, message: "Webhook queued for retry" });
  });

  return app;
}
