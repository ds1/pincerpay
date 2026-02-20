import { describe, it, expect } from "vitest";
import { CHAINS } from "@pincerpay/core";

describe("Chain resources", () => {
  it("CHAINS registry has 6 entries", () => {
    const keys = Object.keys(CHAINS);
    expect(keys).toHaveLength(6);
    expect(keys).toContain("solana");
    expect(keys).toContain("base");
    expect(keys).toContain("polygon");
    expect(keys).toContain("solana-devnet");
    expect(keys).toContain("base-sepolia");
    expect(keys).toContain("polygon-amoy");
  });

  it("each chain has required fields", () => {
    for (const chain of Object.values(CHAINS)) {
      expect(chain.caip2Id).toBeTruthy();
      expect(chain.shorthand).toBeTruthy();
      expect(chain.name).toBeTruthy();
      expect(chain.namespace).toMatch(/^(eip155|solana)$/);
      expect(chain.usdcAddress).toBeTruthy();
      expect(chain.usdcDecimals).toBe(6);
      expect(chain.blockTimeMs).toBeGreaterThan(0);
      expect(chain.explorerUrl).toBeTruthy();
    }
  });

  it("Solana chains have solana namespace", () => {
    expect(CHAINS["solana"]!.namespace).toBe("solana");
    expect(CHAINS["solana-devnet"]!.namespace).toBe("solana");
  });

  it("EVM chains have eip155 namespace", () => {
    expect(CHAINS["base"]!.namespace).toBe("eip155");
    expect(CHAINS["polygon"]!.namespace).toBe("eip155");
    expect(CHAINS["base-sepolia"]!.namespace).toBe("eip155");
    expect(CHAINS["polygon-amoy"]!.namespace).toBe("eip155");
  });
});
