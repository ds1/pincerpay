import { describe, it, expect, beforeAll } from "vitest";
import { base58 } from "@scure/base";
import { x402Facilitator } from "@x402/core/facilitator";
import { setupSolanaFacilitator } from "../chains/solana.js";
import { createLogger } from "../middleware/logging.js";

const TEST_CHAIN = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // Solana devnet

describe("Solana facilitator setup", () => {
  let testSolanaKey: string;

  beforeAll(async () => {
    // Generate Ed25519 keypair using Web Crypto API
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

  it("registers SVM scheme on facilitator", async () => {
    const facilitator = new x402Facilitator();
    const logger = createLogger("silent");

    await setupSolanaFacilitator(facilitator, {
      privateKey: testSolanaKey,
      networks: [TEST_CHAIN],
      logger,
    });

    const { kinds } = facilitator.getSupported();
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.some((s) => s.network === TEST_CHAIN)).toBe(true);
  });

  it("registers multiple Solana networks", async () => {
    const facilitator = new x402Facilitator();
    const logger = createLogger("silent");
    const networks = [
      TEST_CHAIN,
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // mainnet
    ];

    await setupSolanaFacilitator(facilitator, {
      privateKey: testSolanaKey,
      networks,
      logger,
    });

    const { kinds } = facilitator.getSupported();
    for (const network of networks) {
      expect(kinds.some((s) => s.network === network)).toBe(true);
    }
  });
});
