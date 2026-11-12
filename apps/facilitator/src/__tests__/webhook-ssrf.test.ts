import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Database } from "@pincerpay/db";

// Resolve test hostnames to chosen addresses; everything else uses real DNS.
vi.mock("node:dns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns")>();
  const fake: Record<string, string> = {
    "rebind.example.com": "10.0.0.5",
    "metadata.example.com": "169.254.169.254",
  };
  return {
    ...actual,
    lookup: (hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
      const address = fake[hostname];
      if (!address) return (actual.lookup as Function)(hostname, options, callback);
      callback(null, [{ address, family: 4 }]);
    },
  };
});

const { postWebhook, setWebhookAllowPrivate, WebhookDeliveryError } = await import("../webhooks/deliver.js");
const { dispatchWebhook } = await import("../webhooks/dispatcher.js");
const { bootstrapMerchantSchema, patchMerchantSchema } = await import("../routes/onboarding/schemas.js");

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

afterEach(() => setWebhookAllowPrivate(false));

async function expectBlocked(url: string) {
  const err = await postWebhook(url, "{}", {}, 2_000).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(WebhookDeliveryError);
  expect((err as InstanceType<typeof WebhookDeliveryError>).publicReason).toBe("blocked_destination");
}

describe("postWebhook destination policy", () => {
  it.each([
    "https://127.0.0.1/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://kora.railway.internal/hook",
    "https://localhost/hook",
    "http://api.example.com/hook",
  ])("refuses %s before connecting", async (url) => {
    await expectBlocked(url);
  });

  it("refuses a public hostname that resolves to a private address", async () => {
    await expectBlocked("https://rebind.example.com/hook");
  });

  it("refuses a public hostname that resolves to the metadata address", async () => {
    await expectBlocked("https://metadata.example.com/latest/meta-data");
  });
});

describe("postWebhook redirects", () => {
  let server: http.Server;
  let port: number;
  const hits: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits.push(req.url ?? "");
      if (req.url === "/redirect") {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/target` });
        return res.end();
      }
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("returns the redirect status without following it", async () => {
    setWebhookAllowPrivate(true);
    const status = await postWebhook(`http://127.0.0.1:${port}/redirect`, "{}", {}, 2_000);
    expect(status).toBe(302);
    expect(hits).toEqual(["/redirect"]);
  });

  it("delivers to a local receiver when private destinations are allowed", async () => {
    setWebhookAllowPrivate(true);
    expect(await postWebhook(`http://127.0.0.1:${port}/ok`, "{}", {}, 2_000)).toBe(200);
  });
});

/** Mock DB that records delivery-row updates. */
function mockDb() {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: "delivery-1" }]) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return { where: () => Promise.resolve() };
      },
    }),
  } as unknown as Database;
  return { db, updates };
}

describe("dispatchWebhook to an internal destination", () => {
  it("fails the delivery permanently with a generic reason", async () => {
    const { db, updates } = mockDb();
    await dispatchWebhook(db, {
      merchantId: "merchant-1",
      environment: "live",
      webhookUrl: "https://rebind.example.com/hook",
      payload: {
        event: "payment.settled",
        transaction: { txHash: "x", chainId: "solana", amount: "1", fromAddress: "a", toAddress: "b", status: "confirmed" },
      },
      logger,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "failed", lastError: "blocked_destination", attempts: 1 });
    expect(JSON.stringify(updates[0])).not.toContain("10.0.0.5");
  });
});

describe("onboarding webhook URL validation", () => {
  it("rejects internal webhook URLs at write time", () => {
    const base = { name: "Acme", walletAddress: "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde" };
    expect(bootstrapMerchantSchema.safeParse({ ...base, webhookUrlLive: "https://kora.railway.internal/x" }).success).toBe(false);
    expect(patchMerchantSchema.safeParse({ webhookUrlTest: "http://10.0.0.5/x" }).success).toBe(false);
  });

  it("accepts public https webhook URLs and null", () => {
    expect(patchMerchantSchema.safeParse({ webhookUrlLive: "https://api.acme.com/hooks" }).success).toBe(true);
    expect(patchMerchantSchema.safeParse({ webhookUrlLive: null }).success).toBe(true);
  });
});
