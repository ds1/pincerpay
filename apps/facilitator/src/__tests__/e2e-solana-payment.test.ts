import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { createHash } from "node:crypto";
import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402Client } from "@x402/core/client";
import {
  ExactSvmScheme as SvmClientScheme,
  registerExactSvmScheme as registerClientSvm,
} from "@x402/svm/exact/client";
import { setupSolanaFacilitator } from "../chains/solana.js";
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
import {
  apiKeys,
  transactions,
  merchants,
  agents,
  webhookDeliveries,
} from "@pincerpay/db";
import type { WebhookPayload } from "../webhooks/dispatcher.js";

// ─── Test Constants ───

const TEST_CHAIN = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // Solana devnet
const TEST_API_KEY = "pp_live_test_solana1234567890";
const TEST_API_KEY_HASH = createHash("sha256")
  .update(TEST_API_KEY)
  .digest("hex");
const TEST_MERCHANT_ID = "00000000-0000-4000-a000-000000000011";
const TEST_API_KEY_ID = "00000000-0000-4000-a000-000000000012";

const FAKE_TX_SIGNATURE =
  "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

// 32-byte deterministic blockhash for mock RPC
const FAKE_BLOCKHASH = base58.encode(new Uint8Array(32).fill(42));

// ─── Keypair Generation ───

async function generateSolanaKeypair(): Promise<{
  privateKeyBase58: string;
  address: string;
}> {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", privateKey),
  );
  const secretBytes = pkcs8.slice(-32);
  const publicBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", publicKey),
  );
  const combined = new Uint8Array(64);
  combined.set(secretBytes, 0);
  combined.set(publicBytes, 32);
  return {
    privateKeyBase58: base58.encode(combined),
    address: base58.encode(publicBytes),
  };
}

// ─── Mock Solana RPC Server ───

function createMockSolanaRpc(): Hono {
  const app = new Hono();

  // Build mock USDC mint account data (82 bytes, SPL Token Mint struct)
  const mintData = new Uint8Array(82);
  mintData[0] = 1; // COption<Pubkey> mintAuthority = Some
  // bytes 1-3: 0 (rest of u32 LE tag)
  // bytes 4-35: mint authority pubkey (32 zero bytes = dummy)
  // supply at offset 36 (u64 LE) = 1_000_000_000_000 (1M USDC)
  const supply = 1_000_000_000_000n;
  for (let i = 0; i < 8; i++) {
    mintData[36 + i] = Number((supply >> BigInt(i * 8)) & 0xffn);
  }
  mintData[44] = 6; // decimals = 6 (USDC)
  mintData[45] = 1; // is_initialized = true
  // bytes 46-81: freeze_authority = None (all zeros)

  const MINT_DATA_BASE64 = Buffer.from(mintData).toString("base64");

  function handleRpcCall(method: string, _params?: unknown[]): unknown {
    switch (method) {
      case "getAccountInfo":
        // Returns USDC mint account data (for fetchMint)
        return {
          context: { slot: 100 },
          value: {
            data: [MINT_DATA_BASE64, "base64"],
            executable: false,
            lamports: 1_461_600,
            owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            rentEpoch: 0,
            space: 82,
          },
        };
      case "getLatestBlockhash":
        return {
          context: { slot: 100 },
          value: {
            blockhash: FAKE_BLOCKHASH,
            lastValidBlockHeight: 200,
          },
        };
      case "simulateTransaction":
        return {
          context: { slot: 100 },
          value: {
            err: null,
            logs: [
              "Program log: Instruction: TransferChecked",
              "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success",
            ],
            accounts: null,
            unitsConsumed: 5000,
            returnData: null,
          },
        };
      case "sendTransaction":
        return FAKE_TX_SIGNATURE;
      case "getSignatureStatuses":
        return {
          context: { slot: 100 },
          value: [
            {
              slot: 99,
              confirmations: 10,
              err: null,
              status: { Ok: null },
              confirmationStatus: "confirmed",
            },
          ],
        };
      case "getBalance":
        return { context: { slot: 100 }, value: 10_000_000_000 }; // 10 SOL
      default:
        console.warn(`Mock Solana RPC: unhandled method "${method}"`);
        return null;
    }
  }

  app.post("/", async (c) => {
    const body = await c.req.json();

    // Handle batched requests
    if (Array.isArray(body)) {
      const results = body.map(
        (req: { id: number; method: string; params?: unknown[] }) => ({
          jsonrpc: "2.0",
          id: req.id,
          result: handleRpcCall(req.method, req.params),
        }),
      );
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
  gasToken?: string;
  status: string;
  optimistic: boolean;
  endpoint?: string;
  agentId?: string;
}

function createMockDb(webhookReceiverUrl: string): {
  db: Database;
  inserts: CapturedInsert[];
} {
  const inserts: CapturedInsert[] = [];

  // Build a chainable mock that mimics Drizzle's query builder.
  // Resolves synchronously (like the EVM e2e test) so fire-and-forget
  // DB chains complete before the next test assertion.
  function thenable(value: unknown = []) {
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) => {
        resolve(value);
        return obj;
      },
      catch: (_fn: (e: unknown) => void) => obj,
    };
    return obj;
  }

  const db = {
    select: (_fields?: unknown) => ({
      from: (table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (_n: number) => {
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
            if (table === merchants) {
              return thenable([{ webhookUrl: webhookReceiverUrl }]);
            }
            if (table === agents) {
              return thenable([]); // Agent not found → triggers auto-register
            }
            return thenable([]);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (data: unknown) => {
        if (table === transactions) {
          inserts.push(data as CapturedInsert);
        }
        const base = thenable();
        return {
          ...base,
          returning: () => {
            if (table === agents)
              return thenable([{ id: "mock-agent-id" }]);
            if (table === webhookDeliveries)
              return thenable([{ id: "mock-webhook-id" }]);
            return thenable([{ id: "mock-id" }]);
          },
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

// ─── Webhook Receiver ───

function createWebhookReceiver(): {
  app: Hono;
  received: WebhookPayload[];
  promise: Promise<WebhookPayload>;
} {
  const received: WebhookPayload[] = [];
  let resolve!: (v: WebhookPayload) => void;
  const promise = new Promise<WebhookPayload>((r) => {
    resolve = r;
  });

  const app = new Hono();
  app.post("/webhook", async (c) => {
    const body = (await c.req.json()) as WebhookPayload;
    received.push(body);
    resolve(body);
    return c.json({ ok: true });
  });

  return { app, received, promise };
}

// ─── App Builders ───

async function buildSolanaFacilitatorApp(
  mockDb: Database,
  rpcUrl: string,
  facilitatorKey: string,
): Promise<Hono<AppEnv>> {
  const facilitator = new x402Facilitator();
  const silentLogger = createLogger("silent");

  await setupSolanaFacilitator(facilitator, {
    privateKey: facilitatorKey,
    networks: [TEST_CHAIN],
    rpcUrls: { [TEST_CHAIN]: rpcUrl },
    logger: silentLogger,
  });

  const app = new Hono<AppEnv>();
  app.use("*", loggingMiddleware(silentLogger));

  // Public routes
  const mockWorkerStatus = {
    getStatus: () => ({
      running: false,
      lastCycleAt: null,
      cycleCount: 0,
      consecutiveErrors: 0,
      lastError: null,
    }),
  };
  app.route(
    "/",
    createHealthRoute({
      db: mockDb,
      workers: {
        confirmation: mockWorkerStatus,
        webhookRetry: mockWorkerStatus,
      },
    }),
  );
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

function buildSolanaMerchantApp(
  facilitatorUrl: string,
  merchantAddress: string,
): Hono {
  const app = new Hono();

  app.use(
    "/api/test",
    createPincerPayMiddleware({
      apiKey: TEST_API_KEY,
      merchantAddress,
      facilitatorUrl,
      routes: {
        "GET /api/test": {
          price: "0.001",
          chain: "solana-devnet",
          description: "Test Solana resource",
        },
      },
    }),
  );

  app.get("/api/test", (c) => c.json({ data: "solana-hello" }));
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

describe("E2E Solana payment flow", () => {
  let rpcServer: ServerType;
  let facilitatorServer: ServerType;
  let merchantServer: ServerType;
  let webhookServer: ServerType;
  let merchantPort: number;
  let mockInserts: CapturedInsert[];
  let agent: PincerPayAgent;
  let webhookReceived: WebhookPayload[];
  let webhookPromise: Promise<WebhookPayload>;

  beforeAll(async () => {
    // 1. Generate Ed25519 keypairs for facilitator, agent, and merchant
    const facilitatorKeypair = await generateSolanaKeypair();
    const agentKeypair = await generateSolanaKeypair();
    const merchantKeypair = await generateSolanaKeypair();

    // 2. Start mock Solana RPC
    const rpc = await startServer(createMockSolanaRpc());
    rpcServer = rpc.server;
    const rpcUrl = `http://127.0.0.1:${rpc.port}`;

    // 3. Start webhook receiver
    const webhook = createWebhookReceiver();
    webhookReceived = webhook.received;
    webhookPromise = webhook.promise;
    const wh = await startServer(webhook.app);
    webhookServer = wh.server;
    const webhookUrl = `http://127.0.0.1:${wh.port}/webhook`;

    // 4. Start facilitator (with mock RPC + mock DB)
    const { db, inserts } = createMockDb(webhookUrl);
    mockInserts = inserts;
    const facilitatorApp = await buildSolanaFacilitatorApp(
      db,
      rpcUrl,
      facilitatorKeypair.privateKeyBase58,
    );
    const fac = await startServer(facilitatorApp);
    facilitatorServer = fac.server;
    const facilitatorUrl = `http://127.0.0.1:${fac.port}/v1`;

    // 5. Start merchant (pointing to facilitator)
    const merchantApp = buildSolanaMerchantApp(
      facilitatorUrl,
      merchantKeypair.address,
    );
    const mer = await startServer(merchantApp);
    merchantServer = mer.server;
    merchantPort = mer.port;

    // 6. Create agent with custom x402 client (SVM scheme → mock RPC)
    const client = new x402Client();
    const agentKeyBytes = base58.decode(agentKeypair.privateKeyBase58);
    const agentSigner = await createKeyPairSignerFromBytes(agentKeyBytes);

    // Register V1 + V2 SVM schemes (V2 will be overridden with mock RPC)
    registerClientSvm(client, { signer: agentSigner });
    // Override V2 scheme with one pointing to mock RPC
    client.register(
      "solana:*" as `${string}:${string}`,
      new SvmClientScheme(agentSigner, { rpcUrl }),
    );

    agent = new PincerPayAgent(
      {
        chains: ["solana-devnet"],
        solanaPrivateKey: agentKeypair.privateKeyBase58,
      },
      client,
    );
  }, 30_000);

  afterAll(async () => {
    const close = (s: ServerType) =>
      new Promise<void>((resolve) => s?.close(() => resolve()));
    await Promise.all([
      close(merchantServer),
      close(facilitatorServer),
      close(rpcServer),
      close(webhookServer),
    ]);
  });

  it("agent pays and receives resource", async () => {
    const res = await agent.fetch(
      `http://127.0.0.1:${merchantPort}/api/test`,
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: string };
    expect(body).toEqual({ data: "solana-hello" });
  }, 30_000);

  it("transaction recorded in DB with Solana fields", () => {
    expect(mockInserts.length).toBeGreaterThanOrEqual(1);
    const record = mockInserts[0]!;

    expect(record.merchantId).toBe(TEST_MERCHANT_ID);
    expect(record.chainId).toBe(TEST_CHAIN);
    expect(record.txHash).toBeTruthy();
    expect(record.amount).toBe("1000"); // 0.001 USDC = 1000 base units
    expect(record.gasToken).toBe("SOL");
    expect(record.status).toBe("optimistic"); // < 1 USDC threshold
    expect(record.optimistic).toBe(true);
  });

  it("webhook fires with payment.settled event", async () => {
    const payload = await webhookPromise;
    expect(payload.event).toBe("payment.settled");
    expect(payload.transaction).toBeDefined();
    expect(payload.transaction.chainId).toBe(TEST_CHAIN);
    expect(payload.transaction.amount).toBe("1000");
    expect(payload.transaction.status).toBe("optimistic");
  }, 10_000);

  it("non-paywalled routes pass through", async () => {
    const res = await fetch(
      `http://127.0.0.1:${merchantPort}/api/free`,
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: string };
    expect(body).toEqual({ data: "free" });
  });

  it("health check works", async () => {
    const addr = facilitatorServer.address();
    const facilitatorPort =
      typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(
      `http://127.0.0.1:${facilitatorPort}/health`,
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pincerpay-facilitator");
  });
});

describe("E2E Solana — facilitator scheme registration", () => {
  it("facilitator registers Solana devnet scheme", async () => {
    const facilitator = new x402Facilitator();
    const keypair = await generateSolanaKeypair();
    const logger = createLogger("silent");

    await setupSolanaFacilitator(facilitator, {
      privateKey: keypair.privateKeyBase58,
      networks: [TEST_CHAIN],
      logger,
    });

    const { kinds } = facilitator.getSupported();
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.some((s) => s.network === TEST_CHAIN)).toBe(true);
  });

  it("/supported returns Solana devnet with feePayer", async () => {
    const facilitator = new x402Facilitator();
    const keypair = await generateSolanaKeypair();
    const logger = createLogger("silent");

    await setupSolanaFacilitator(facilitator, {
      privateKey: keypair.privateKeyBase58,
      networks: [TEST_CHAIN],
      logger,
    });

    const { kinds } = facilitator.getSupported();
    const solanaKind = kinds.find((s) => s.network === TEST_CHAIN);
    expect(solanaKind).toBeDefined();
    expect(solanaKind!.scheme).toBe("exact");
    expect(solanaKind!.extra?.feePayer).toBeTruthy();
  });
});

describe.skip("E2E Solana — Anchor direct settlement", () => {
  it("settle-direct validates merchant registration", () => {
    // TODO: Implement when Anchor direct settlement agent-side signing is complete
    expect(true).toBe(true);
  });

  it("direct settlement records correct DB fields", () => {
    // TODO: Verify DB record includes anchor-specific fields (programId, slot)
    expect(true).toBe(true);
  });
});

describe.skip("E2E Solana — Kora gasless settlement", () => {
  it("Kora facilitator registers with USDC gas token", () => {
    // TODO: Blocked by issues #1-3 (deploy Kora node)
    expect(true).toBe(true);
  });

  it("gasless settlement records gasToken as USDC", () => {
    // TODO: Verify gasToken is USDC instead of SOL when Kora is enabled
    expect(true).toBe(true);
  });
});
