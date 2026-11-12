import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { base58 } from "@scure/base";
import { x402Client } from "@x402/core/client";
import { PincerPayAgent } from "../client.js";
import type { PaymentRequired } from "../index.js";
import type { SpendingPolicy } from "@pincerpay/core";

// Test private key (DO NOT use in production — this is a well-known test key)
const TEST_EVM_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("PincerPayAgent", () => {
  it("requires at least one wallet key", () => {
    expect(
      () => new PincerPayAgent({ chains: ["base"] }),
    ).toThrow("At least one wallet key");
  });

  it("creates agent with EVM key", () => {
    const agent = new PincerPayAgent({
      chains: ["base-sepolia"],
      evmPrivateKey: TEST_EVM_KEY,
    });
    expect(agent.chains).toEqual(["base-sepolia"]);
    expect(agent.evmAddress).toBeTruthy();
    expect(agent.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("derives correct EVM address", () => {
    const agent = new PincerPayAgent({
      chains: ["base"],
      evmPrivateKey: TEST_EVM_KEY,
    });
    // This is the well-known address for the hardhat account #0
    expect(agent.evmAddress?.toLowerCase()).toBe(
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    );
  });
});

describe("PincerPayAgent spending policies", () => {
  let agent: PincerPayAgent;

  beforeEach(() => {
    agent = new PincerPayAgent({
      chains: ["base"],
      evmPrivateKey: TEST_EVM_KEY,
      policies: [
        {
          maxPerTransaction: "1000000", // 1 USDC
          maxPerDay: "5000000", // 5 USDC
        },
      ],
    });
  });

  it("allows transactions within per-tx limit", () => {
    const result = agent.checkPolicy("500000"); // 0.5 USDC
    expect(result.allowed).toBe(true);
  });

  it("blocks transactions exceeding per-tx limit", () => {
    const result = agent.checkPolicy("1500000"); // 1.5 USDC
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("per-transaction limit");
  });

  it("allows exactly the per-tx limit", () => {
    const result = agent.checkPolicy("1000000"); // 1 USDC
    expect(result.allowed).toBe(true);
  });

  it("tracks daily spending", () => {
    agent.recordSpend("2000000"); // 2 USDC
    agent.recordSpend("2000000"); // 2 USDC (total 4 USDC)

    // 1 USDC more should be allowed (total 5 USDC = limit)
    expect(agent.checkPolicy("1000000").allowed).toBe(true);

    // But 1.5 USDC more would exceed daily (total 5.5 > 5)
    expect(agent.checkPolicy("1500000").allowed).toBe(false);
  });

  it("blocks when daily limit would be exceeded", () => {
    agent.recordSpend("4500000"); // 4.5 USDC

    const result = agent.checkPolicy("600000"); // 0.6 USDC (total 5.1 > 5)
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("daily limit");
  });

  it("allows all transactions with no policies", () => {
    const noPolicyAgent = new PincerPayAgent({
      chains: ["base"],
      evmPrivateKey: TEST_EVM_KEY,
    });

    const result = noPolicyAgent.checkPolicy("999999999999");
    expect(result.allowed).toBe(true);
  });
});

describe("PincerPayAgent Solana support", () => {
  let testSolanaKey: string;

  beforeAll(async () => {
    // Generate Ed25519 keypair using Web Crypto API (Node 22+)
    const { privateKey, publicKey } = await crypto.subtle.generateKey(
      "Ed25519",
      true,
      ["sign", "verify"],
    );
    // Raw export not supported for Ed25519 private keys — use PKCS#8 and take last 32 bytes
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
    const secretBytes = pkcs8.slice(-32);
    const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
    const combined = new Uint8Array(64);
    combined.set(secretBytes, 0);
    combined.set(publicBytes, 32);
    testSolanaKey = base58.encode(combined);
  });

  it("creates agent with Solana key via async factory", async () => {
    const agent = await PincerPayAgent.create({
      chains: ["solana-devnet"],
      solanaPrivateKey: testSolanaKey,
    });
    expect(agent.chains).toEqual(["solana-devnet"]);
    expect(agent.solanaAddress).toBeTruthy();
    expect(agent.solanaAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("creates dual-chain agent with both EVM and Solana keys", async () => {
    const agent = await PincerPayAgent.create({
      chains: ["base-sepolia", "solana-devnet"],
      evmPrivateKey: TEST_EVM_KEY,
      solanaPrivateKey: testSolanaKey,
    });
    expect(agent.evmAddress).toBeTruthy();
    expect(agent.solanaAddress).toBeTruthy();
    expect(agent.chains).toEqual(["base-sepolia", "solana-devnet"]);
  });

  it("enforces spending policies with Solana agent", async () => {
    const agent = await PincerPayAgent.create({
      chains: ["solana-devnet"],
      solanaPrivateKey: testSolanaKey,
      policies: [{ maxPerTransaction: "1000000" }],
    });
    expect(agent.checkPolicy("500000").allowed).toBe(true);
    expect(agent.checkPolicy("1500000").allowed).toBe(false);
  });

  it("returns undefined solanaAddress when only EVM key provided", () => {
    const agent = new PincerPayAgent({
      chains: ["base"],
      evmPrivateKey: TEST_EVM_KEY,
    });
    expect(agent.solanaAddress).toBeUndefined();
  });
});

describe("PincerPayAgent allowlists (#167)", () => {
  const MERCHANT_A = "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde";
  const MERCHANT_B = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";
  const EVM_MERCHANT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

  function agentWith(policy: Record<string, unknown>) {
    return new PincerPayAgent({ chains: ["solana"], evmPrivateKey: TEST_EVM_KEY, policies: [policy] });
  }

  it("refuses a payTo outside allowedMerchants", () => {
    const agent = agentWith({ allowedMerchants: [MERCHANT_A] });
    expect(agent.checkPolicy("1000", { payTo: MERCHANT_A, network: SOLANA_MAINNET }).allowed).toBe(true);
    const check = agent.checkPolicy("1000", { payTo: MERCHANT_B, network: SOLANA_MAINNET });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("Merchant not in allowlist");
  });

  it("compares EVM merchants case-insensitively", () => {
    const agent = agentWith({ allowedMerchants: [EVM_MERCHANT] });
    expect(agent.checkPolicy("1000", { payTo: EVM_MERCHANT.toLowerCase(), network: "eip155:8453" }).allowed).toBe(true);
  });

  it("refuses when an allowlist is set but payTo is unknown", () => {
    const agent = agentWith({ allowedMerchants: [MERCHANT_A] });
    expect(agent.checkPolicy("1000").allowed).toBe(false);
  });

  it("matches a CAIP-2 network against a shorthand allowedChains entry", () => {
    const agent = agentWith({ allowedChains: ["solana"] });
    expect(agent.checkPolicy("1000", { payTo: MERCHANT_A, network: SOLANA_MAINNET }).allowed).toBe(true);
    const check = agent.checkPolicy("1000", { payTo: MERCHANT_A, network: "eip155:8453" });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("Chain not in allowlist");
  });

  it("the pre-payment hook passes payTo and network to the policy check", async () => {
    let beforeHook: ((ctx: unknown) => Promise<unknown>) | undefined;
    const fakeClient = {
      onBeforePaymentCreation: (fn: (ctx: unknown) => Promise<unknown>) => {
        beforeHook = fn;
      },
      onAfterPaymentCreation: () => {},
    };
    new PincerPayAgent(
      { chains: ["solana"], evmPrivateKey: TEST_EVM_KEY, policies: [{ allowedMerchants: [MERCHANT_A] }] },
      fakeClient as never,
    );

    const blocked = await beforeHook!({
      selectedRequirements: { amount: "1000", payTo: MERCHANT_B, network: SOLANA_MAINNET },
    });
    expect(blocked).toMatchObject({ abort: true });

    const allowed = await beforeHook!({
      selectedRequirements: { amount: "1000", payTo: MERCHANT_A, network: SOLANA_MAINNET },
    });
    expect(allowed).toBeUndefined();
  });
});

describe("PincerPayAgent.createPaymentPayload (#178)", () => {
  const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
  const STUD = "Qa4Vp4kMKD5P8syNrc1ywz7WHiCt4poyykCKR21zLxP";
  const STRANGER = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";

  // A real x402Client with a fake `exact` scheme on every Solana network, so
  // the test runs x402's own selection and hook pipeline without a signer.
  function agentWithFakeScheme(policies?: SpendingPolicy[]) {
    const signed: unknown[] = [];
    const client = new x402Client().register("solana:*", {
      scheme: "exact",
      createPaymentPayload: async (x402Version: number, requirements: unknown) => {
        signed.push(requirements);
        return { x402Version, payload: { transaction: "signed-by-fake-scheme" } };
      },
    });
    const agent = new PincerPayAgent(
      { chains: ["solana-devnet"], evmPrivateKey: TEST_EVM_KEY, policies },
      client,
    );
    return { agent, signed };
  }

  function paymentRequired(payTo: string): PaymentRequired {
    return {
      x402Version: 2,
      resource: { url: "urn:stud:quote:q1", description: "500 credits" },
      accepts: [
        {
          scheme: "exact",
          network: SOLANA_DEVNET,
          amount: "20000000",
          asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
          payTo,
          maxTimeoutSeconds: 300,
          extra: { feePayer: STRANGER },
        },
      ],
    };
  }

  it("signs a challenge that arrived outside HTTP and returns the payload", async () => {
    const { agent, signed } = agentWithFakeScheme();
    const required = paymentRequired(STUD);

    const payload = await agent.createPaymentPayload(required);

    expect(signed).toEqual([required.accepts[0]]);
    expect(payload.x402Version).toBe(2);
    expect(payload.accepted).toEqual(required.accepts[0]);
    expect(payload.resource).toEqual(required.resource);
    expect(payload.payload).toEqual({ transaction: "signed-by-fake-scheme" });
  });

  it("runs the spending policies and refuses a payTo outside allowedMerchants", async () => {
    const { agent, signed } = agentWithFakeScheme([{ allowedMerchants: [STUD] }]);

    await expect(agent.createPaymentPayload(paymentRequired(STRANGER))).rejects.toThrow(
      /Payment creation aborted: Merchant not in allowlist/,
    );
    expect(signed).toHaveLength(0);
  });

  it("counts a signed payment toward the daily limit", async () => {
    const { agent } = agentWithFakeScheme([
      { allowedMerchants: [STUD], maxPerTransaction: "20000000", maxPerDay: "30000000" },
    ]);

    await agent.createPaymentPayload(paymentRequired(STUD));
    expect(agent.getDailySpend().amount).toBe(20_000_000n);

    await expect(agent.createPaymentPayload(paymentRequired(STUD))).rejects.toThrow(
      /Exceeds daily limit/,
    );
  });
});
