import { describe, it, expect } from "vitest";
import {
  resolveChain,
  toCAIP2,
  getMainnetChains,
  getTestnetChains,
  CHAINS,
  CHAINS_BY_CAIP2,
  BASE_MAINNET,
  BASE_SEPOLIA,
  POLYGON_MAINNET,
  SOLANA_MAINNET,
  SOLANA_DEVNET,
} from "../chains/index.js";

describe("resolveChain", () => {
  it("resolves by shorthand", () => {
    expect(resolveChain("base")).toBe(BASE_MAINNET);
    expect(resolveChain("base-sepolia")).toBe(BASE_SEPOLIA);
    expect(resolveChain("polygon")).toBe(POLYGON_MAINNET);
    expect(resolveChain("solana")).toBe(SOLANA_MAINNET);
  });

  it("resolves by CAIP-2 ID", () => {
    expect(resolveChain("eip155:8453")).toBe(BASE_MAINNET);
    expect(resolveChain("eip155:84532")).toBe(BASE_SEPOLIA);
    expect(resolveChain("eip155:137")).toBe(POLYGON_MAINNET);
    expect(resolveChain("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(SOLANA_MAINNET);
    expect(resolveChain("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(SOLANA_DEVNET);
  });

  it("returns undefined for unknown chains", () => {
    expect(resolveChain("ethereum")).toBeUndefined();
    expect(resolveChain("eip155:999")).toBeUndefined();
    expect(resolveChain("")).toBeUndefined();
  });
});

describe("toCAIP2", () => {
  it("converts shorthand to CAIP-2 ID", () => {
    expect(toCAIP2("base")).toBe("eip155:8453");
    expect(toCAIP2("polygon")).toBe("eip155:137");
    expect(toCAIP2("base-sepolia")).toBe("eip155:84532");
    expect(toCAIP2("solana")).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    expect(toCAIP2("solana-devnet")).toBe("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
  });

  it("passes through already-valid CAIP-2 IDs", () => {
    expect(toCAIP2("eip155:8453")).toBe("eip155:8453");
  });

  it("throws for unknown chains", () => {
    expect(() => toCAIP2("ethereum")).toThrow('Unknown chain: "ethereum"');
  });
});

describe("getMainnetChains / getTestnetChains", () => {
  it("returns only mainnets", () => {
    const mainnets = getMainnetChains();
    expect(mainnets.length).toBe(3);
    expect(mainnets.every((c) => !c.testnet)).toBe(true);
  });

  it("returns only testnets", () => {
    const testnets = getTestnetChains();
    expect(testnets.length).toBe(3);
    expect(testnets.every((c) => c.testnet)).toBe(true);
  });
});

describe("CHAINS registry", () => {
  it("has 6 total chains", () => {
    expect(Object.keys(CHAINS).length).toBe(6);
  });

  it("CHAINS_BY_CAIP2 reverse lookup matches", () => {
    for (const chain of Object.values(CHAINS)) {
      expect(CHAINS_BY_CAIP2[chain.caip2Id]).toBe(chain);
    }
  });

  it("all chains have required fields", () => {
    for (const chain of Object.values(CHAINS)) {
      expect(chain.caip2Id).toBeTruthy();
      expect(chain.shorthand).toBeTruthy();
      expect(chain.name).toBeTruthy();
      expect(chain.namespace).toMatch(/^(eip155|solana)$/);
      expect(chain.usdcAddress).toBeTruthy();
      expect(chain.usdcDecimals).toBe(6);
      expect(chain.rpcUrl).toBeTruthy();
      expect(chain.explorerUrl).toBeTruthy();
      expect(chain.blockTimeMs).toBeGreaterThan(0);
    }
  });

  it("EVM chains have numeric chainId", () => {
    for (const chain of Object.values(CHAINS)) {
      if (chain.namespace === "eip155") {
        expect(chain.chainId).toBeTypeOf("number");
      }
    }
  });

  it("Solana chains have 400ms block time", () => {
    for (const chain of Object.values(CHAINS)) {
      if (chain.namespace === "solana") {
        expect(chain.blockTimeMs).toBe(400);
        expect(chain.chainId).toBeUndefined();
      }
    }
  });
});
