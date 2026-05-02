import { generateMerchantWallets } from "@pincerpay/onboarding";

export interface CreateWalletsOptions {
  strength?: 12 | 24;
  mnemonic?: string;
  json?: boolean;
  noPrivateKeys?: boolean;
}

export async function runCreateWallets(options: CreateWalletsOptions): Promise<void> {
  const wallets = await generateMerchantWallets({
    strength: options.strength === 24 ? 256 : 128,
    mnemonic: options.mnemonic,
  });

  if (options.json) {
    if (options.noPrivateKeys) {
      console.log(JSON.stringify({
        mnemonic: wallets.mnemonic,
        solana: { address: wallets.solana.address, derivationPath: wallets.solana.derivationPath },
        evm: { address: wallets.evm.address, derivationPath: wallets.evm.derivationPath },
      }, null, 2));
    } else {
      console.log(JSON.stringify(wallets, null, 2));
    }
    return;
  }

  const banner = "=".repeat(72);
  console.log(banner);
  console.log("PincerPay non-custodial wallet bootstrap");
  console.log(banner);
  console.log();
  console.log("Mnemonic (save this — recovery is impossible without it):");
  console.log(`  ${wallets.mnemonic}`);
  console.log();
  console.log("Solana (Phantom-compatible)");
  console.log(`  Address:        ${wallets.solana.address}`);
  console.log(`  Derivation:     ${wallets.solana.derivationPath}`);
  if (!options.noPrivateKeys) {
    console.log(`  Private key:    ${wallets.solana.privateKey}`);
  }
  console.log();
  console.log("EVM (MetaMask-compatible — Polygon, Base, Ethereum)");
  console.log(`  Address:        ${wallets.evm.address}`);
  console.log(`  Derivation:     ${wallets.evm.derivationPath}`);
  if (!options.noPrivateKeys) {
    console.log(`  Private key:    ${wallets.evm.privateKey}`);
  }
  console.log();
  console.log(banner);
  console.log();
  console.log("Save the mnemonic in a password manager.");
  console.log("Import into Phantom (Solana) or MetaMask (EVM) to use a wallet UI.");
}
