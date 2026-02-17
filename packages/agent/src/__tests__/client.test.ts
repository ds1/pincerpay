import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { base58 } from "@scure/base";
import { PincerPayAgent } from "../client.js";

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
