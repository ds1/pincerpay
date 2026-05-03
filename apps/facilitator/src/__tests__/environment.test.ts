import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { createHash } from "node:crypto";
import { x402Facilitator } from "@x402/core/facilitator";
import { authMiddleware } from "../middleware/auth.js";
import { loggingMiddleware, createLogger } from "../middleware/logging.js";
import { createVerifyRoute } from "../routes/verify.js";
import { createSettleRoute } from "../routes/settle.js";
import type { AppEnv } from "../env.js";
import type { Database, Environment } from "@pincerpay/db";
import { apiKeys } from "@pincerpay/db";

const LIVE_KEY = "pp_live_envtest_____________12345";
const TEST_KEY = "pp_test_envtest_____________12345";
const LIVE_HASH = createHash("sha256").update(LIVE_KEY).digest("hex");
const TEST_HASH = createHash("sha256").update(TEST_KEY).digest("hex");

const MERCHANT_ID = "00000000-0000-4000-a000-000000000041";
const LIVE_KEY_ID = "00000000-0000-4000-a000-000000000042";
const TEST_KEY_ID = "00000000-0000-4000-a000-000000000043";

function thenable(value: unknown = []) {
  const obj = {
    then: (resolve: (v: unknown) => void) => {
      resolve(value);
      return obj;
    },
    catch: () => obj,
  };
  return obj;
}

const KEY_BY_HASH: Record<string, { env: Environment; id: string; prefix: string }> = {
  [LIVE_HASH]: { env: "live", id: LIVE_KEY_ID, prefix: LIVE_KEY.slice(0, 12) },
  [TEST_HASH]: { env: "test", id: TEST_KEY_ID, prefix: TEST_KEY.slice(0, 12) },
};

function findHash(cond: unknown): string | null {
  // Walk the Drizzle SQL AST looking for any string that matches a known hash.
  const seen = new Set<unknown>();
  const stack: unknown[] = [cond];
  while (stack.length) {
    const node = stack.pop();
    if (node == null || seen.has(node)) continue;
    seen.add(node);
    if (typeof node === "string" && KEY_BY_HASH[node]) return node;
    if (typeof node !== "object") continue;
    for (const v of Object.values(node as Record<string, unknown>)) {
      stack.push(v);
    }
  }
  return null;
}

function buildMockDb(): Database {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: unknown) => ({
          limit: () => {
            if (table === apiKeys) {
              const hash = findHash(cond);
              if (hash) {
                const meta = KEY_BY_HASH[hash];
                return thenable([
                  {
                    id: meta.id,
                    merchantId: MERCHANT_ID,
                    keyHash: hash,
                    prefix: meta.prefix,
                    label: meta.env,
                    isActive: true,
                    environment: meta.env,
                    createdAt: new Date(),
                    lastUsedAt: null,
                  },
                ]);
              }
              return thenable([]);
            }
            return thenable([
              {
                webhookUrlLive: null,
                webhookSecretLive: null,
                webhookUrlTest: null,
                webhookSecretTest: null,
              },
            ]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: () => {
        const base = thenable();
        return { ...base, returning: () => thenable([{ id: "x" }]) };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => thenable(),
      }),
    }),
    execute: () => thenable([]),
  } as unknown as Database;
}

function buildApp(db: Database) {
  const facilitator = new x402Facilitator();
  const silentLogger = createLogger("silent");
  const app = new Hono<AppEnv>();
  app.use("*", loggingMiddleware(silentLogger));
  const authed = new Hono<AppEnv>();
  authed.use("*", authMiddleware(db));
  authed.route("/", createVerifyRoute(facilitator));
  authed.route("/", createSettleRoute(facilitator, db));
  app.route("/", authed);
  return app;
}

function startServer(app: { fetch: Hono["fetch"] }) {
  return new Promise<{ server: ServerType; port: number }>((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      resolve({ server, port: info.port });
    });
  });
}

const SOLANA_MAINNET_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_DEVNET_NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const REQUIREMENTS_BASE = {
  scheme: "exact" as const,
  resource: "http://x.test/r",
  description: "test",
  mimeType: "application/json",
  payTo: "11111111111111111111111111111112",
  asset: "USDC",
  amount: "1000",
};

const FAKE_PAYLOAD = {
  scheme: "exact" as const,
  network: SOLANA_DEVNET_NETWORK,
  payload: {},
};

describe("environment-scoped key routing", () => {
  let server: ServerType;
  let url: string;

  beforeAll(async () => {
    const { server: s, port } = await startServer(buildApp(buildMockDb()));
    server = s;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  async function callVerify(apiKey: string, network: string) {
    return fetch(`${url}/v1/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pincerpay-api-key": apiKey,
      },
      body: JSON.stringify({
        paymentPayload: { ...FAKE_PAYLOAD, network },
        paymentRequirements: { ...REQUIREMENTS_BASE, network },
      }),
    });
  }

  async function callSettle(apiKey: string, network: string) {
    return fetch(`${url}/v1/settle`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pincerpay-api-key": apiKey,
      },
      body: JSON.stringify({
        paymentPayload: { ...FAKE_PAYLOAD, network },
        paymentRequirements: { ...REQUIREMENTS_BASE, network },
      }),
    });
  }

  it("test key is rejected with 403 on a mainnet network (verify)", async () => {
    const res = await callVerify(TEST_KEY, SOLANA_MAINNET_NETWORK);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("test_key_chain_forbidden");
  });

  it("test key is rejected with 403 on a mainnet network (settle)", async () => {
    const res = await callSettle(TEST_KEY, SOLANA_MAINNET_NETWORK);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("test_key_chain_forbidden");
  });

  it("test key passes the env gate on a testnet network (verify falls through to x402)", async () => {
    const res = await callVerify(TEST_KEY, SOLANA_DEVNET_NETWORK);
    // Past the env gate. x402 itself returns 200 with isValid=false because
    // the payload is fabricated; the relevant assertion is that we did NOT
    // get a 403 from the env-gate.
    expect(res.status).not.toBe(403);
  });

  it("live key passes the env gate on any network (verify)", async () => {
    const mainnetRes = await callVerify(LIVE_KEY, SOLANA_MAINNET_NETWORK);
    expect(mainnetRes.status).not.toBe(403);
    const devnetRes = await callVerify(LIVE_KEY, SOLANA_DEVNET_NETWORK);
    expect(devnetRes.status).not.toBe(403);
  });
});
