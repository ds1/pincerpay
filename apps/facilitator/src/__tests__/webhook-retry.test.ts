import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import { createWebhookRoutes } from "../routes/webhooks.js";
import type { AppEnv } from "../env.js";

const MERCHANT_ID = "00000000-0000-4000-a000-000000000179";
const DELIVERY_ID = "00000000-0000-4000-a000-000000000180";

// A delivery that exhausted its five attempts and was dead-lettered.
const failedDelivery = {
  id: DELIVERY_ID,
  merchantId: MERCHANT_ID,
  environment: "test",
  event: "payment.settled",
  url: "https://merchant.example/webhook",
  payload: "{}",
  status: "failed",
  attempts: 5,
  maxAttempts: 5,
  nextRetryAt: null,
  lastError: "HTTP 500",
};

function buildFakeDb(setCalls: Array<Record<string, unknown>>): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [failedDelivery],
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        setCalls.push(values);
        return { where: async () => undefined };
      },
    }),
  } as unknown as Database;
}

function buildApp(db: Database) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("merchantId", MERCHANT_ID);
    await next();
  });
  app.route("/", createWebhookRoutes(db));
  return app;
}

describe("POST /v1/webhooks/:id/retry", () => {
  it("re-queues a failed delivery on the status the retry worker polls", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    const app = buildApp(buildFakeDb(setCalls));

    const res = await app.request(`/v1/webhooks/${DELIVERY_ID}/retry`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].status).toBe("retrying");
    expect(setCalls[0].nextRetryAt).toBeInstanceOf(Date);
  });
});
