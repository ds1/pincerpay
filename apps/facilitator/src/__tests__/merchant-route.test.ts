import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { createMerchantRoute } from "../routes/merchant.js";

type MerchantRecord = Record<string, unknown>;

const BASE_RECORD: MerchantRecord = {
  id: "merchant-1",
  name: "STUD",
  walletAddress: "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde",
  supportedChains: ["solana"],
  webhookUrlLive: null,
  webhookUrlTest: "https://example.com/hook",
  webhookSecretLive: "never-returned",
  webhookSecretTest: "never-returned",
  authUserId: "auth-user-1",
  onChainRegistered: false,
  merchantPda: null,
  feeBps: 100,
  createdAt: "2026-11-11T00:00:00.000Z",
  updatedAt: "2026-11-11T00:00:00.000Z",
};

/**
 * Fake db that behaves like Drizzle's partial select: it returns only the
 * columns the route asks for, keyed by the selection's field names.
 */
function fakeDb(record: MerchantRecord | undefined): Database {
  return {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              record ? [Object.fromEntries(Object.keys(fields).map((key) => [key, record[key]]))] : [],
            ),
        }),
      }),
    }),
  } as unknown as Database;
}

function buildApp(db: Database) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("merchantId", "merchant-1");
    c.set("environment", "test");
    c.set("requestId", "req-1");
    c.set("logger", { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AppEnv["Variables"]["logger"]);
    await next();
  });
  app.route("/", createMerchantRoute(db));
  return app;
}

describe("GET /v1/merchant", () => {
  it("returns feeBps with the default of 100", async () => {
    const res = await buildApp(fakeDb(BASE_RECORD)).request("/v1/merchant");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.feeBps).toBe(100);
    expect(body.id).toBe("merchant-1");
    expect(body.walletAddress).toBe(BASE_RECORD.walletAddress);
  });

  it("returns a merchant's own feeBps", async () => {
    const res = await buildApp(fakeDb({ ...BASE_RECORD, feeBps: 250 })).request("/v1/merchant");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { feeBps: number }).feeBps).toBe(250);
  });

  it("never returns webhook secrets", async () => {
    const res = await buildApp(fakeDb(BASE_RECORD)).request("/v1/merchant");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("webhookSecretLive");
    expect(body).not.toHaveProperty("webhookSecretTest");
    expect(body).not.toHaveProperty("authUserId");
  });

  it("returns 404 when the merchant row is missing", async () => {
    const res = await buildApp(fakeDb(undefined)).request("/v1/merchant");
    expect(res.status).toBe(404);
  });
});
