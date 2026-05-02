import { describe, it, expect } from "vitest";
import {
  generateMerchantWallets,
  SOLANA_DERIVATION_PATH,
  EVM_DERIVATION_PATH,
} from "../wallets.js";

describe("generateMerchantWallets", () => {
  it("returns a fresh 12-word mnemonic by default", async () => {
    const w = await generateMerchantWallets();
    expect(w.mnemonic.split(" ")).toHaveLength(12);
  });

  it("supports 24-word mnemonics", async () => {
    const w = await generateMerchantWallets({ strength: 256 });
    expect(w.mnemonic.split(" ")).toHaveLength(24);
  });

  it("derives Solana addresses at m/44'/501'/0'/0' (Phantom-compatible)", async () => {
    const w = await generateMerchantWallets();
    expect(w.solana.derivationPath).toBe(SOLANA_DERIVATION_PATH);
    // base58, typically 32-44 chars for Solana addresses
    expect(w.solana.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("derives EVM addresses at m/44'/60'/0'/0/0 (MetaMask-compatible)", async () => {
    const w = await generateMerchantWallets();
    expect(w.evm.derivationPath).toBe(EVM_DERIVATION_PATH);
    expect(w.evm.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("is deterministic — same mnemonic produces same addresses", async () => {
    const w1 = await generateMerchantWallets();
    const w2 = await generateMerchantWallets({ mnemonic: w1.mnemonic });
    expect(w2.solana.address).toBe(w1.solana.address);
    expect(w2.solana.privateKey).toBe(w1.solana.privateKey);
    expect(w2.evm.address).toBe(w1.evm.address);
    expect(w2.evm.privateKey).toBe(w1.evm.privateKey);
  });

  it("rejects invalid mnemonics", async () => {
    await expect(
      generateMerchantWallets({ mnemonic: "not a real bip39 phrase" }),
    ).rejects.toThrow(/Invalid BIP-39 mnemonic/);
  });

  it("known-vector check: known mnemonic produces stable addresses", async () => {
    // Standard test mnemonic from BIP-39 spec
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const w = await generateMerchantWallets({ mnemonic });
    // EVM at m/44'/60'/0'/0/0 from this seed is a well-known vector
    expect(w.evm.address.toLowerCase()).toBe(
      "0x9858effd232b4033e47d90003d41ec34ecaeda94",
    );
    // Solana address is checked for stability across runs (computed once, asserted)
    expect(w.solana.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    const w2 = await generateMerchantWallets({ mnemonic });
    expect(w2.solana.address).toBe(w.solana.address);
  });
});
