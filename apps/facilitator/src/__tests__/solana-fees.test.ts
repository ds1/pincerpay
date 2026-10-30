import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase64Decoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { createSettleRoute } from "../routes/settle.js";
import { createVerifyRoute } from "../routes/verify.js";
import {
  DEFAULT_SOLANA_FEE_LIMITS,
  checkSolanaFeeLimits,
  readSolanaFeeParams,
} from "../chains/solana-fees.js";

const COMPUTE_BUDGET = address("ComputeBudget111111111111111111111111111111");
const FEE_PAYER = address("GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm");
const MERCHANT_WALLET = "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde";
const EXTRA_SIGNERS = [
  address("E53zfNo9DYxAUCu37bA2NakJMMbzPFszjgB5kPaTMvF3"),
  address("Qa4Vp4kMKD5P8syNrc1ywz7WHiCt4poyykCKR21zLxP"),
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
];
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

function computeLimitIx(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return { programAddress: COMPUTE_BUDGET, data };
}

function computePriceIx(microLamports: bigint): Instruction {
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, microLamports, true);
  return { programAddress: COMPUTE_BUDGET, data };
}

/** Additional signer accounts, attached to a memo-style no-op instruction. */
function signersIx(count: number): Instruction {
  return {
    programAddress: address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    accounts: EXTRA_SIGNERS.slice(0, count).map((a) => ({ address: a, role: AccountRole.READONLY_SIGNER })),
    data: new Uint8Array([0x68, 0x69]),
  };
}

function buildTx(instructions: Instruction[]): string {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(FEE_PAYER, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(
      { blockhash: blockhash("EtWTRABZaYq6iMfeYKouRu166VU2xqa1EtWTRABZaYq6"), lastValidBlockHeight: 1n },
      m,
    ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const bytes = getTransactionEncoder().encode(compileTransaction(message));
  return getBase64Decoder().decode(bytes);
}

/** What the stock x402 SVM client builds: 20,000 CU at 1 microlamport/CU. */
const STOCK_TX = buildTx([computeLimitIx(20_000), computePriceIx(1n)]);
/** Protocol maximums: 1.4M CU at the 5,000,000 microlamport/CU x402 cap (~0.007 SOL). */
const DRAIN_TX = buildTx([computeLimitIx(1_400_000), computePriceIx(5_000_000n)]);

describe("readSolanaFeeParams", () => {
  it("reads the compute limit, price, priority fee and signer count", () => {
    expect(readSolanaFeeParams(DRAIN_TX)).toEqual({
      computeUnitLimit: 1_400_000,
      computeUnitPriceMicroLamports: 5_000_000n,
      priorityFeeLamports: 7_000_000n,
      signatures: 1,
    });
  });

  it("rounds the priority fee up to whole lamports", () => {
    expect(readSolanaFeeParams(STOCK_TX).priorityFeeLamports).toBe(1n);
  });

  it("assumes the transaction maximum when no compute limit is set", () => {
    const params = readSolanaFeeParams(buildTx([computePriceIx(1n)]));
    expect(params.computeUnitLimit).toBe(1_400_000);
  });

  it("throws on bytes that are not a transaction", () => {
    expect(() => readSolanaFeeParams("bm90IGEgdHJhbnNhY3Rpb24=")).toThrow();
  });
});

describe("checkSolanaFeeLimits", () => {
  const limits = DEFAULT_SOLANA_FEE_LIMITS;

  it("accepts the stock x402 client transaction", () => {
    expect(checkSolanaFeeLimits(readSolanaFeeParams(STOCK_TX), limits)).toBeNull();
  });

  it("rejects a compute limit above the cap", () => {
    const tx = buildTx([computeLimitIx(1_400_000), computePriceIx(1n)]);
    expect(checkSolanaFeeLimits(readSolanaFeeParams(tx), limits)).toMatch(/compute unit limit/);
  });

  it("rejects a priority fee above the cap within the compute limit", () => {
    // 200,000 CU × 5,000,000 µL = 1,000,000 lamports
    const tx = buildTx([computeLimitIx(200_000), computePriceIx(5_000_000n)]);
    expect(checkSolanaFeeLimits(readSolanaFeeParams(tx), limits)).toMatch(/priority fee/);
  });

  it("rejects more signatures than the cap", () => {
    const tx = buildTx([computeLimitIx(20_000), computePriceIx(1n), signersIx(3)]);
    expect(checkSolanaFeeLimits(readSolanaFeeParams(tx), limits)).toMatch(/signatures/);
  });
});

/** Mock DB whose merchant lookup returns the merchant's wallet. */
function mockDb(): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ walletAddress: MERCHANT_WALLET }]) }),
      }),
    }),
  } as unknown as Database;
}

function mockFacilitator() {
  return {
    verify: vi.fn().mockResolvedValue({ isValid: true, payer: "agent" }),
    settle: vi.fn().mockResolvedValue({ success: false, errorReason: "mock", transaction: "", network: SOLANA_DEVNET }),
  };
}

function buildApp(facilitator: ReturnType<typeof mockFacilitator>) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("merchantId", "merchant-1");
    c.set("environment", "live");
    c.set("requestId", "req-1");
    c.set("logger", { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AppEnv["Variables"]["logger"]);
    await next();
  });
  const f = facilitator as unknown as x402Facilitator;
  app.route("/", createVerifyRoute(f, mockDb()));
  app.route("/", createSettleRoute(f, mockDb()));
  return app;
}

function paymentBody(transaction: string, network = SOLANA_DEVNET) {
  return JSON.stringify({
    paymentPayload: { x402Version: 2, payload: { transaction }, resource: { url: "https://api.example.com/data" } },
    paymentRequirements: {
      scheme: "exact",
      network,
      amount: "1000",
      asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      payTo: MERCHANT_WALLET,
      maxTimeoutSeconds: 60,
      extra: { feePayer: FEE_PAYER },
    },
  });
}

function post(app: Hono<AppEnv>, path: string, body: string) {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body });
}

describe("/v1/settle fee cap", () => {
  it("does not broadcast a transaction whose fees exceed the cap", async () => {
    const facilitator = mockFacilitator();
    const res = await post(buildApp(facilitator), "/v1/settle", paymentBody(DRAIN_TX));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("solana_fee_exceeds_cap");
    expect(facilitator.settle).not.toHaveBeenCalled();
  });

  it("settles the stock x402 client transaction", async () => {
    const facilitator = mockFacilitator();
    await post(buildApp(facilitator), "/v1/settle", paymentBody(STOCK_TX));
    expect(facilitator.settle).toHaveBeenCalledOnce();
  });

  it("rejects a transaction that does not decode", async () => {
    const facilitator = mockFacilitator();
    const res = await post(buildApp(facilitator), "/v1/settle", paymentBody("bm90IGEgdHJhbnNhY3Rpb24="));
    expect(res.status).toBe(400);
    expect(facilitator.settle).not.toHaveBeenCalled();
  });
});

describe("/v1/verify fee cap", () => {
  it("rejects a transaction whose fees exceed the cap", async () => {
    const facilitator = mockFacilitator();
    const res = await post(buildApp(facilitator), "/v1/verify", paymentBody(DRAIN_TX));

    expect(res.status).toBe(400);
    expect(facilitator.verify).not.toHaveBeenCalled();
  });

  it("leaves non-Solana networks to x402", async () => {
    const facilitator = mockFacilitator();
    await post(buildApp(facilitator), "/v1/verify", paymentBody(DRAIN_TX, "eip155:84532"));
    expect(facilitator.verify).toHaveBeenCalledOnce();
  });
});
