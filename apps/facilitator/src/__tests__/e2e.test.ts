import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { createHash } from "node:crypto";
import { x402Facilitator } from "@x402/core/facilitator";
import { setupEvmFacilitator } from "../chains/evm.js";
import { loggingMiddleware, createLogger } from "../middleware/logging.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/ratelimit.js";
import { createHealthRoute } from "../routes/health.js";
import { createVerifyRoute } from "../routes/verify.js";
import { createSettleRoute } from "../routes/settle.js";
import { createSupportedRoute } from "../routes/supported.js";
import { PincerPayAgent } from "@pincerpay/agent";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";
import type { AppEnv } from "../env.js";
import type { Database } from "@pincerpay/db";
import { apiKeys, transactions } from "@pincerpay/db";

// ─── Test Constants ───

// Hardhat #0 — facilitator signer
const FACILITATOR_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

// Hardhat #1 — agent wallet
const AGENT_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;

// Hardhat #2 — merchant address
const MERCHANT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const TEST_API_KEY = "pp_live_test1234567890";
const TEST_API_KEY_HASH = createHash("sha256").update(TEST_API_KEY).digest("hex");
const TEST_MERCHANT_ID = "00000000-0000-4000-a000-000000000001";
const TEST_API_KEY_ID = "00000000-0000-4000-a000-000000000002";
const TEST_CHAIN = "eip155:84532";

const FAKE_TX_HASH = "0x" + "ab".repeat(32);

// ─── Mock RPC Server ───

function createMockRpc(): Hono {
  const app = new Hono();

  function handleRpcCall(method: string, _params?: unknown[]): unknown {
    switch (method) {
      case "eth_chainId":
        return "0x14a34"; // 84532
      case "eth_call":
        // First call: USDC balanceOf → large balance (32 bytes, 100 USDC)
        // Also handles EIP-712 domain separator, USDC version(), name(), etc.
        return "0x" + "0".repeat(56) + "05f5e100"; // 100 USDC
      case "eth_getTransactionCount":
        return "0x0";
      case "eth_estimateGas":
        return "0x5208"; // 21000
      case "eth_gasPrice":
        return "0x3b9aca00"; // 1 gwei
      case "eth_maxPriorityFeePerGas":
        return "0x59682f00"; // 1.5 gwei
      case "eth_getBlockByNumber":
        return {
          number: "0x1",
          hash: "0x" + "00".repeat(32),
          timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
          baseFeePerGas: "0x3b9aca00",
          gasLimit: "0x1c9c380",
          gasUsed: "0x0",
          transactions: [],
        };
      case "eth_sendRawTransaction":
        return FAKE_TX_HASH;
      case "eth_getTransactionReceipt":
        return {
          transactionHash: FAKE_TX_HASH,
          blockNumber: "0x1",
          blockHash: "0x" + "00".repeat(32),
          from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          to: MERCHANT_ADDRESS,
          status: "0x1",
          gasUsed: "0x5208",
          cumulativeGasUsed: "0x5208",
          logs: [],
          logsBloom: "0x" + "00".repeat(256),
        };
      default:
        return null;
    }
  }

  app.post("/", async (c) => {
    const body = await c.req.json();

    // Handle batched requests
    if (Array.isArray(body)) {
      const results = body.map((req: { id: number; method: string; params?: unknown[] }) => ({
        jsonrpc: "2.0",
        id: req.id,
        result: handleRpcCall(req.method, req.params),
      }));
      return c.json(results);
    }

    return c.json({
      jsonrpc: "2.0",
      id: body.id,
      result: handleRpcCall(body.method, body.params),
    });
  });

  return app;
}

// ─── Mock Database ───

interface CapturedInsert {
  merchantId: string;
  chainId: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  status: string;
  optimistic: boolean;
  endpoint?: string;
}

function createMockDb(): { db: Database; inserts: CapturedInsert[] } {
  const inserts: CapturedInsert[] = [];

  // Build a chainable mock that mimics Drizzle's query builder
  function thenable(value: unknown = []) {
    const obj = {
      then: (resolve: (v: unknown) => void) => {
        resolve(value);
        return obj;
      },
      catch: (_fn: (e: unknown) => void) => obj,
    };
    return obj;
  }

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (_n: number) => {
            // Auth middleware looks up API key
            if (table === apiKeys) {
              return thenable([
                {
                  id: TEST_API_KEY_ID,
                  merchantId: TEST_MERCHANT_ID,
                  keyHash: TEST_API_KEY_HASH,
                  prefix: TEST_API_KEY.slice(0, 12),
                  label: "Test",
                  isActive: true,
                  createdAt: new Date(),
                  lastUsedAt: null,
                },
              ]);
            }
            return thenable([]);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (data: CapturedInsert) => {
        if (table === transactions) {
          inserts.push(data);
        }
        const base = thenable();
        return {
          ...base,
          returning: () => thenable([{ id: "mock-id" }]),
        };
      },
    }),
    update: (_table: unknown) => ({
      set: (_data: unknown) => ({
        where: (_condition: unknown) => thenable(),
      }),
    }),
    execute: () => thenable([{ "?column?": 1 }]),
  } as unknown as Database;

  return { db, inserts };
}

// ─── App Builders ───

function buildFacilitatorApp(
  mockDb: Database,
  rpcUrl: string,
): Hono<AppEnv> {
  const facilitator = new x402Facilitator();
  const silentLogger = createLogger("silent");

  setupEvmFacilitator(facilitator, {
    privateKey: FACILITATOR_KEY,
    networks: [TEST_CHAIN],
    rpcUrls: { [TEST_CHAIN]: rpcUrl },
    logger: silentLogger,
  });

  const app = new Hono<AppEnv>();
  app.use("*", loggingMiddleware(silentLogger));

  // Public routes
  const mockWorkerStatus = { getStatus: () => ({ running: false, lastCycleAt: null, cycleCount: 0, consecutiveErrors: 0, lastError: null }) };
  app.route("/", createHealthRoute({ db: mockDb, workers: { confirmation: mockWorkerStatus, webhookRetry: mockWorkerStatus } }));
  app.route("/", createSupportedRoute(facilitator));

  // Authenticated routes
  const authenticated = new Hono<AppEnv>();
  authenticated.use("*", authMiddleware(mockDb));
  authenticated.use("*", rateLimitMiddleware(120));
  authenticated.route("/", createVerifyRoute(facilitator));
  authenticated.route("/", createSettleRoute(facilitator, mockDb));

  app.route("/", authenticated);

  return app;
}

function buildMerchantApp(facilitatorUrl: string): Hono {
  const app = new Hono();

  app.use(
    "/api/test",
    createPincerPayMiddleware({
      apiKey: TEST_API_KEY,
      merchantAddress: MERCHANT_ADDRESS,
      facilitatorUrl,
      routes: {
        "GET /api/test": {
          price: "0.001",
          chain: "base-sepolia",
          description: "Test resource",
        },
      },
    }),
  );

  app.get("/api/test", (c) => c.json({ data: "hello" }));
  app.get("/api/free", (c) => c.json({ data: "free" }));

  return app;
}

// ─── Server Lifecycle ───

function startServer(
  app: { fetch: Hono["fetch"] },
  port = 0,
): Promise<{ server: ServerType; port: number }> {
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      resolve({ server, port: info.port });
    });
  });
}

// ─── Tests ───

describe("E2E payment flow", () => {
  let rpcServer: ServerType;
  let facilitatorServer: ServerType;
  let merchantServer: ServerType;
  let merchantPort: number;
  let mockInserts: CapturedInsert[];
  let agent: PincerPayAgent;

  beforeAll(async () => {
    // 1. Start mock RPC
    const rpc = await startServer(createMockRpc());
    rpcServer = rpc.server;
    const rpcUrl = `http://127.0.0.1:${rpc.port}`;

    // 2. Start facilitator (with mock RPC + mock DB)
    const { db, inserts } = createMockDb();
    mockInserts = inserts;
    const facilitatorApp = buildFacilitatorApp(db, rpcUrl);
    const fac = await startServer(facilitatorApp);
    facilitatorServer = fac.server;
    const facilitatorUrl = `http://127.0.0.1:${fac.port}/v1`;

    // 3. Start merchant (pointing to facilitator)
    const merchantApp = buildMerchantApp(facilitatorUrl);
    const mer = await startServer(merchantApp);
    merchantServer = mer.server;
    merchantPort = mer.port;

    // 4. Create agent
    agent = new PincerPayAgent({
      chains: ["base-sepolia"],
      evmPrivateKey: AGENT_KEY,
    });
  }, 30_000);

  afterAll(async () => {
    const close = (s: ServerType) =>
      new Promise<void>((resolve) => s?.close(() => resolve()));
    await Promise.all([
      close(merchantServer),
      close(facilitatorServer),
      close(rpcServer),
    ]);
  });

  it("agent pays and receives resource", async () => {
    const res = await agent.fetch(`http://127.0.0.1:${merchantPort}/api/test`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: string };
    expect(body).toEqual({ data: "hello" });
  }, 30_000);

  it("transaction recorded in DB", () => {
    expect(mockInserts.length).toBeGreaterThanOrEqual(1);
    const record = mockInserts[0]!;

    expect(record.merchantId).toBe(TEST_MERCHANT_ID);
    expect(record.chainId).toBe(TEST_CHAIN);
    expect(record.txHash).toBeTruthy();
    expect(record.toAddress).toBe(MERCHANT_ADDRESS);
    expect(record.amount).toBe("1000"); // 0.001 USDC = 1000 base units
    expect(record.status).toBe("optimistic"); // < 1 USDC threshold
  });

  it("non-paywalled routes pass through", async () => {
    const res = await fetch(`http://127.0.0.1:${merchantPort}/api/free`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: string };
    expect(body).toEqual({ data: "free" });
  });

  it("health check works", async () => {
    // Use facilitator's port directly
    const addr = facilitatorServer.address();
    const facilitatorPort = typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${facilitatorPort}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pincerpay-facilitator");
  });
});
