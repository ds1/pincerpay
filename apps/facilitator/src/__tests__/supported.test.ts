import { describe, it, expect } from "vitest";
import { allowedSupportedNetworks } from "../routes/supported.js";
import { buildTestApp } from "./test-app.js";

const DEVNET_SOLANA = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const BASE_SEPOLIA = "eip155:84532";

describe("allowedSupportedNetworks", () => {
  it("includes each configured CAIP-2 id and its x402-v1 short-name alias", () => {
    const allowed = allowedSupportedNetworks([DEVNET_SOLANA, BASE_SEPOLIA]);
    expect(allowed.has(DEVNET_SOLANA)).toBe(true);
    expect(allowed.has(BASE_SEPOLIA)).toBe(true);
    expect(allowed.has("solana-devnet")).toBe(true);
    expect(allowed.has("base-sepolia")).toBe(true);
    // Mainnet names are never derived from a testnet config.
    expect(allowed.has("base")).toBe(false);
    expect(allowed.has("solana")).toBe(false);
  });
});

describe("/v1/supported (testnet-only scoping)", () => {
  it("drops advertised kinds for networks this facilitator is not configured for", async () => {
    const app = buildTestApp({
      supportedNetworks: [DEVNET_SOLANA, BASE_SEPOLIA],
      supportedKinds: [
        // What this deploy actually settles on (v2 CAIP-2 + v1 aliases):
        { x402Version: 2, scheme: "exact", network: DEVNET_SOLANA },
        { x402Version: 2, scheme: "exact", network: BASE_SEPOLIA },
        { x402Version: 1, scheme: "exact", network: "solana-devnet" },
        { x402Version: 1, scheme: "exact", network: "base-sepolia" },
        // Over-advertised mainnets / unrelated testnets from the @x402 registry:
        { x402Version: 1, scheme: "exact", network: "solana" },
        { x402Version: 1, scheme: "exact", network: "ethereum" },
        { x402Version: 1, scheme: "exact", network: "base" },
        { x402Version: 1, scheme: "exact", network: "polygon" },
        { x402Version: 1, scheme: "exact", network: "avalanche" },
      ],
    });

    const res = await app.request("/v1/supported");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kinds: Array<{ network: string }> };
    const networks = body.kinds.map((k) => k.network).sort();

    expect(networks).toEqual(
      [BASE_SEPOLIA, DEVNET_SOLANA, "base-sepolia", "solana-devnet"].sort(),
    );
    for (const mainnet of ["solana", "ethereum", "base", "polygon", "avalanche"]) {
      expect(networks).not.toContain(mainnet);
    }
  });
});
