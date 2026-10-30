import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { rejectForeignPayTo, rejectTestKeyOnMainnet } from "../routes/guards.js";

const SOLANA_WALLET = "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde";
const EVM_WALLET = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const BASE_SEPOLIA = "eip155:84532";

/** Mock DB whose merchant lookup returns the given rows. */
function mockDb(rows: Array<{ walletAddress: string }>): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(rows) }),
      }),
    }),
  } as unknown as Database;
}

function buildApp(db: Database, environment: "live" | "test" = "live") {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("merchantId", "merchant-1");
    c.set("environment", environment);
    c.set("requestId", "req-1");
    c.set("logger", { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AppEnv["Variables"]["logger"]);
    await next();
  });
  app.post("/check", async (c) => {
    const { network, payTo } = await c.req.json();
    const testKey = rejectTestKeyOnMainnet(c, network, "test_key_rejected");
    if (testKey) return testKey;
    const foreign = await rejectForeignPayTo(c, db, { network, payTo });
    if (foreign) return foreign;
    return c.json({ ok: true });
  });
  return app;
}

function check(app: Hono<AppEnv>, network: string, payTo: string) {
  return app.request("/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ network, payTo }),
  });
}

describe("rejectForeignPayTo", () => {
  it("allows payTo equal to the merchant's Solana wallet", async () => {
    const res = await check(buildApp(mockDb([{ walletAddress: SOLANA_WALLET }])), SOLANA_DEVNET, SOLANA_WALLET);
    expect(res.status).toBe(200);
  });

  it("rejects a Solana payTo that is not the merchant's wallet", async () => {
    const res = await check(
      buildApp(mockDb([{ walletAddress: SOLANA_WALLET }])),
      SOLANA_DEVNET,
      "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm",
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("pay_to_not_merchant_wallet");
  });

  it("compares Solana addresses case-sensitively", async () => {
    const res = await check(
      buildApp(mockDb([{ walletAddress: SOLANA_WALLET }])),
      SOLANA_DEVNET,
      SOLANA_WALLET.toLowerCase(),
    );
    expect(res.status).toBe(403);
  });

  it("compares EVM addresses case-insensitively", async () => {
    const res = await check(buildApp(mockDb([{ walletAddress: EVM_WALLET }])), BASE_SEPOLIA, EVM_WALLET.toLowerCase());
    expect(res.status).toBe(200);
  });

  it("rejects an EVM payTo that is not the merchant's wallet", async () => {
    const res = await check(
      buildApp(mockDb([{ walletAddress: EVM_WALLET }])),
      BASE_SEPOLIA,
      "0x0000000000000000000000000000000000000001",
    );
    expect(res.status).toBe(403);
  });

  it("rejects when the merchant row is missing", async () => {
    const res = await check(buildApp(mockDb([])), SOLANA_DEVNET, SOLANA_WALLET);
    expect(res.status).toBe(403);
  });
});

describe("rejectTestKeyOnMainnet", () => {
  it("rejects a test key on a mainnet network", async () => {
    const res = await check(buildApp(mockDb([{ walletAddress: SOLANA_WALLET }]), "test"), SOLANA_MAINNET, SOLANA_WALLET);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("test_key_chain_forbidden");
  });

  it("allows a test key on a testnet", async () => {
    const res = await check(buildApp(mockDb([{ walletAddress: SOLANA_WALLET }]), "test"), SOLANA_DEVNET, SOLANA_WALLET);
    expect(res.status).toBe(200);
  });

  it("allows a live key on mainnet", async () => {
    const res = await check(buildApp(mockDb([{ walletAddress: SOLANA_WALLET }]), "live"), SOLANA_MAINNET, SOLANA_WALLET);
    expect(res.status).toBe(200);
  });
});

describe("POST /v1/settle-direct test-key guard (#164)", () => {
  it("rejects a test key on Solana mainnet before touching the program or DB", async () => {
    const { createSettleDirectRoute } = await import("../routes/settle-direct.js");
    const program = new Proxy({}, { get: () => { throw new Error("program must not be called"); } });
    const db = new Proxy({}, { get: () => { throw new Error("db must not be called"); } });

    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("merchantId", "00000000-0000-4000-a000-000000000001");
      c.set("environment", "test");
      c.set("requestId", "req-1");
      c.set("logger", { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AppEnv["Variables"]["logger"]);
      await next();
    });
    app.route("/", createSettleDirectRoute(db as Database, { program: program as never }));

    const res = await app.request("/v1/settle-direct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentAddress: SOLANA_WALLET,
        merchantId: "00000000-0000-4000-a000-000000000001",
        amount: "1000",
        network: SOLANA_MAINNET,
      }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("test_key_chain_forbidden");
  });
});
