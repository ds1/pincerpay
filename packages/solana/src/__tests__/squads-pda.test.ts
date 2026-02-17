import { describe, it, expect } from "vitest";
import type { Address } from "@solana/kit";
import { deriveSmartAccountPda, deriveSettingsPda, deriveSpendingLimitPda } from "../squads/accounts.js";

const MOCK_CREATOR = "11111111111111111111111111111112" as Address;

describe("Squads PDA derivation", () => {
  it("derives deterministic Smart Account PDA", async () => {
    const [pda1, bump1] = await deriveSmartAccountPda(MOCK_CREATOR, 0);
    const [pda2, bump2] = await deriveSmartAccountPda(MOCK_CREATOR, 0);

    // Same inputs → same outputs
    expect(pda1).toBe(pda2);
    expect(bump1).toBe(bump2);
    expect(typeof pda1).toBe("string");
    expect(pda1.length).toBeGreaterThan(30); // valid base58 address
  });

  it("different indices produce different PDAs", async () => {
    const [pda0] = await deriveSmartAccountPda(MOCK_CREATOR, 0);
    const [pda1] = await deriveSmartAccountPda(MOCK_CREATOR, 1);
    expect(pda0).not.toBe(pda1);
  });

  it("derives Settings PDA from Smart Account PDA", async () => {
    const [smartAccountPda] = await deriveSmartAccountPda(MOCK_CREATOR, 0);
    const [settingsPda, bump] = await deriveSettingsPda(smartAccountPda);

    expect(typeof settingsPda).toBe("string");
    expect(settingsPda.length).toBeGreaterThan(30);
    expect(settingsPda).not.toBe(smartAccountPda);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("derives Spending Limit PDA", async () => {
    const [smartAccountPda] = await deriveSmartAccountPda(MOCK_CREATOR, 0);
    const [limitPda0] = await deriveSpendingLimitPda(smartAccountPda, 0);
    const [limitPda1] = await deriveSpendingLimitPda(smartAccountPda, 1);

    expect(limitPda0).not.toBe(limitPda1);
    expect(typeof limitPda0).toBe("string");
    expect(limitPda0.length).toBeGreaterThan(30);
  });

  it("PDA derivation is deterministic across calls", async () => {
    const [smart1] = await deriveSmartAccountPda(MOCK_CREATOR, 42);
    const [settings1] = await deriveSettingsPda(smart1);
    const [limit1] = await deriveSpendingLimitPda(smart1, 7);

    // Second run
    const [smart2] = await deriveSmartAccountPda(MOCK_CREATOR, 42);
    const [settings2] = await deriveSettingsPda(smart2);
    const [limit2] = await deriveSpendingLimitPda(smart2, 7);

    expect(smart1).toBe(smart2);
    expect(settings1).toBe(settings2);
    expect(limit1).toBe(limit2);
  });
});
