import { describe, it, expect } from "vitest";
import { toBaseUnits, resolveRouteChains, getUsdcAsset } from "../client.js";

describe("toBaseUnits", () => {
  it("converts whole numbers", () => {
    expect(toBaseUnits("1")).toBe("1000000");
    expect(toBaseUnits("100")).toBe("100000000");
  });

  it("converts decimal amounts", () => {
    expect(toBaseUnits("0.01")).toBe("10000");
    expect(toBaseUnits("0.001")).toBe("1000");
    expect(toBaseUnits("1.50")).toBe("1500000");
    expect(toBaseUnits("0.000001")).toBe("1");
  });

  it("truncates beyond 6 decimals", () => {
    expect(toBaseUnits("0.0000001")).toBe("0");
    expect(toBaseUnits("1.1234567")).toBe("1123456");
  });

  it("handles zero", () => {
    expect(toBaseUnits("0")).toBe("0");
    expect(toBaseUnits("0.00")).toBe("0");
  });

  it("handles large amounts", () => {
    expect(toBaseUnits("1000000")).toBe("1000000000000");
  });
});

describe("resolveRouteChains", () => {
  it("resolves single chain shorthand", () => {
    const result = resolveRouteChains({ price: "0.01", chain: "base" });
    expect(result).toEqual(["eip155:8453"]);
  });

  it("resolves multiple chain shorthands", () => {
    const result = resolveRouteChains({
      price: "0.01",
      chains: ["base", "polygon"],
    });
    expect(result).toEqual(["eip155:8453", "eip155:137"]);
  });

  it("defaults to solana when no chain specified", () => {
    const result = resolveRouteChains({ price: "0.01" });
    expect(result).toEqual(["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"]);
  });

  it("prefers chains array over chain string", () => {
    const result = resolveRouteChains({
      price: "0.01",
      chain: "polygon",
      chains: ["base"],
    });
    expect(result).toEqual(["eip155:8453"]);
  });
});

describe("getUsdcAsset", () => {
  it("returns USDC address for known chains", () => {
    expect(getUsdcAsset("base")).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(getUsdcAsset("polygon")).toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
    expect(getUsdcAsset("solana")).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });

  it("throws for unknown chains", () => {
    expect(() => getUsdcAsset("ethereum")).toThrow("Unknown chain: ethereum");
  });
});
