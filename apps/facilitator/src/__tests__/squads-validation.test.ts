import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../env.js";

// Mock @pincerpay/solana/squads before importing the middleware
vi.mock("@pincerpay/solana/squads", () => ({
  checkSpendingLimit: vi.fn(),
}));

// Mock @pincerpay/db to provide a fake agents table and query builder
vi.mock("@pincerpay/db", () => {
  return {
    agents: { id: "id", solanaAddress: "solana_address", merchantId: "merchant_id" },
    transactions: { amount: "amount", agentId: "agent_id", createdAt: "created_at" },
  };
});

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val, op: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, op: "and" })),
  gte: vi.fn((col: string, val: unknown) => ({ col, val, op: "gte" })),
  sql: vi.fn(() => ({ op: "sql" })),
}));

import { squadsMiddleware } from "../middleware/squads.js";
import { checkSpendingLimit } from "@pincerpay/solana/squads";
import { eq } from "drizzle-orm";

const mockedCheckSpendingLimit = vi.mocked(checkSpendingLimit);

// ─── Helpers ───

function base58ToBytes(address: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const char of address) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base58 char: ${char}`);
    num = num * 58n + BigInt(idx);
  }
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num = num >> 8n;
  }
  return bytes;
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/** Facilitator/Kora signer: the fee payer in x402 exact SVM, never the agent. */
const FACILITATOR_FEE_PAYER = "Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB";

/**
 * Build an x402-shaped Solana transaction (base64): the facilitator pays the
 * fee and the agent is the authority of an SPL TransferChecked instruction.
 */
function buildX402Tx(authorityBase58: string, amount = 1_000_000n): string {
  const filler = (n: number) => new Uint8Array(32).fill(n);
  // Static accounts, ordered: writable signer, readonly signer,
  // writable non-signers, readonly non-signers.
  const accounts = [
    base58ToBytes(FACILITATOR_FEE_PAYER), // 0 fee payer
    base58ToBytes(authorityBase58), // 1 transfer authority (agent)
    filler(7), // 2 source token account
    filler(8), // 3 destination token account
    filler(9), // 4 USDC mint
    base58ToBytes(TOKEN_PROGRAM), // 5 token program
  ];
  const data = Buffer.alloc(10);
  data[0] = 12; // TransferChecked
  data.writeBigUInt64LE(amount, 1);
  data[9] = 6; // decimals

  const message = Buffer.concat([
    Buffer.from([2, 1, 2]), // header: 2 signers, 1 readonly signer, 2 readonly unsigned
    Buffer.from([accounts.length]),
    ...accounts.map((a) => Buffer.from(a)),
    Buffer.alloc(32), // recent blockhash
    Buffer.from([1]), // 1 instruction
    Buffer.from([5, 4, 2, 4, 3, 1, data.length]), // program 5; accounts [src, mint, dst, authority]
    data,
  ]);
  return Buffer.concat([Buffer.from([2]), Buffer.alloc(128), message]).toString("base64");
}

/** A known test address in base58 */
const TEST_PAYER = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";
const TEST_MERCHANT_ID = "merchant-uuid-123";

/**
 * Mock database: the agent lookup (select().from().where().limit()) returns
 * agentRows; the daily-spend aggregate (select().from().where()) resolves to
 * dailyTotal. With throwOnQuery, every query rejects.
 */
function createMockDb(
  agentRows: Record<string, unknown>[],
  opts?: { dailyTotal?: string; throwOnQuery?: boolean },
) {
  const result = <T>(value: T) =>
    opts?.throwOnQuery ? Promise.reject(new Error("db down")) : Promise.resolve(value);
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(() => ({
      limit: vi.fn(() => result(agentRows)),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        result([{ total: opts?.dailyTotal ?? "0" }]).then(resolve, reject),
    })),
  };
  return mockDb as unknown;
}

/** Build a Hono test app with Squads middleware + a dummy settle endpoint. */
function createTestApp(
  db: unknown,
  opts?: { rpcUrl?: string },
) {
  const app = new Hono<AppEnv>();

  // Set required context variables (simulates auth middleware)
  app.use("*", async (c, next) => {
    c.set("merchantId", TEST_MERCHANT_ID);
    c.set("apiKeyId", "test-key");
    c.set("requestId", "test-req");
    c.set("logger", {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
      level: "info",
      silent: vi.fn(),
    });
    await next();
  });

  app.use(
    "/v1/settle",
    squadsMiddleware({
      db: db as any,
      rpcUrl: opts?.rpcUrl ?? "https://api.devnet.solana.com",
    }),
  );

  app.post("/v1/settle", (c) =>
    c.json({ success: true, transaction: "txhash123", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" }),
  );

  return app;
}

/** Build a JSON request body for a Solana settle call. */
function settleBody(overrides?: {
  amount?: string;
  network?: string;
  txBase64?: string;
}) {
  return JSON.stringify({
    paymentPayload: {
      x402Version: 2,
      scheme: "exact",
      network: overrides?.network ?? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      payload: {
        transaction: overrides?.txBase64 ?? buildX402Tx(TEST_PAYER),
      },
      accepted: {},
    },
    paymentRequirements: {
      scheme: "exact",
      network: overrides?.network ?? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      amount: overrides?.amount ?? "1000000",
      payTo: "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde",
    },
  });
}

function postSettle(app: Hono<AppEnv>, body: string) {
  return app.request("/v1/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

// ─── Tests ───

describe("squadsMiddleware", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes through when agent is not found in database (unknown agent)", async () => {
    const db = createMockDb([]); // No matching agent
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("passes through for EVM (non-Solana) payments", async () => {
    const db = createMockDb([]); // Doesn't matter, should skip before DB query
    const app = createTestApp(db);

    const res = await postSettle(
      app,
      settleBody({ network: "eip155:84532" }),
    );
    expect(res.status).toBe(200);
  });

  it("passes through for active agent without Smart Account", async () => {
    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: null,
        maxPerTransaction: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(200);
  });

  it("returns 403 for revoked agent", async () => {
    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "revoked",
        smartAccountPda: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("AGENT_REVOKED");
  });

  it("returns 403 for paused agent", async () => {
    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "paused",
        smartAccountPda: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("AGENT_PAUSED");
  });

  it("returns 403 when per-transaction limit is exceeded", async () => {
    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: "SomeSmartAccountPda",
        maxPerTransaction: "500000", // 0.5 USDC max
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(
      app,
      settleBody({ amount: "1000000" }), // 1 USDC requested
    );
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("PER_TX_LIMIT_EXCEEDED");
  });

  it("returns 403 when on-chain spending limit is exhausted", async () => {
    mockedCheckSpendingLimit.mockResolvedValue({
      exists: true,
      remainingAmount: 100000n, // 0.1 USDC remaining
      period: 1, // Day
      lastReset: 0n,
    });

    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: "SomeSmartAccountPda",
        maxPerTransaction: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(
      app,
      settleBody({ amount: "1000000" }), // 1 USDC requested, only 0.1 remaining
    );
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string; remaining: string };
    expect(body.code).toBe("SPENDING_LIMIT_EXHAUSTED");
    expect(body.remaining).toBe("100000");
  });

  it("passes through when on-chain spending limit has sufficient remaining", async () => {
    mockedCheckSpendingLimit.mockResolvedValue({
      exists: true,
      remainingAmount: 5000000n, // 5 USDC remaining
      period: 1,
      lastReset: 0n,
    });

    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: "SomeSmartAccountPda",
        maxPerTransaction: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(
      app,
      settleBody({ amount: "1000000" }), // 1 USDC requested, 5 remaining
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("passes through when on-chain spending limit account does not exist", async () => {
    mockedCheckSpendingLimit.mockResolvedValue(null);

    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: "SomeSmartAccountPda",
        maxPerTransaction: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(200);
  });

  it("fails closed (503) when the on-chain check throws", async () => {
    mockedCheckSpendingLimit.mockRejectedValue(new Error("RPC timeout"));

    const db = createMockDb([
      {
        id: "agent-1",
        solanaAddress: TEST_PAYER,
        merchantId: TEST_MERCHANT_ID,
        status: "active",
        smartAccountPda: "SomeSmartAccountPda",
        maxPerTransaction: null,
      },
    ]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SPENDING_POLICY_UNAVAILABLE");
  });

  it("passes through when request body is not valid JSON", async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);

    const res = await app.request("/v1/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json{",
    });
    // Middleware should pass through; route handler will deal with it
    expect(res.status).toBe(200);
  });

  it("passes through when paymentPayload has no transaction", async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);

    const res = await app.request("/v1/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: { payload: {} },
        paymentRequirements: {
          network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
          amount: "1000000",
        },
      }),
    });
    expect(res.status).toBe(200);
  });

  it("identifies the agent by transfer authority, not the facilitator fee payer", async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);

    await postSettle(app, settleBody());
    expect(vi.mocked(eq)).toHaveBeenCalledWith("solana_address", TEST_PAYER);
    expect(vi.mocked(eq)).not.toHaveBeenCalledWith("solana_address", FACILITATOR_FEE_PAYER);
  });

  it("returns 403 when the daily limit would be exceeded", async () => {
    const db = createMockDb(
      [
        {
          id: "agent-1",
          solanaAddress: TEST_PAYER,
          merchantId: TEST_MERCHANT_ID,
          status: "active",
          smartAccountPda: null,
          maxPerTransaction: null,
          maxPerDay: "1500000", // 1.5 USDC per day
        },
      ],
      { dailyTotal: "900000" }, // 0.9 already spent today
    );
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody({ amount: "1000000" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("fails closed (503) when the database lookup errors", async () => {
    const db = createMockDb([], { throwOnQuery: true });
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("SPENDING_POLICY_UNAVAILABLE");
  });

  it("fails closed (503) when the transaction cannot be decoded", async () => {
    const db = createMockDb([]);
    const app = createTestApp(db);

    const res = await postSettle(app, settleBody({ txBase64: "AAAA" }));
    expect(res.status).toBe(503);
  });
});
