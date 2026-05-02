import { parseArgs } from "node:util";
import { generateMerchantWallets } from "@pincerpay/onboarding";

const USAGE = `
Usage:
  pnpm create-wallets [flags]

Flags:
  --strength 12|24    Mnemonic word count. Default 12.
  --mnemonic "<...>"  Re-derive addresses from an existing mnemonic.
  --json              Emit JSON instead of human-readable text.
  --no-private-keys   Suppress private key output (addresses + mnemonic only).
  --help              Show this message.

Generates a non-custodial merchant wallet set: one BIP-39 mnemonic plus
Solana and EVM addresses derived from it. Phantom and MetaMask compatible.

The mnemonic and private keys are printed once. PincerPay never sees them.
Save the mnemonic somewhere durable (password manager, hardware wallet) before
closing this terminal. If you lose it, you lose access to any USDC sent to
these addresses.
`.trim();

interface Args {
  strength: 128 | 256;
  mnemonic?: string;
  json: boolean;
  noPrivateKeys: boolean;
}

function parse(): Args {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      strength: { type: "string", default: "12" },
      mnemonic: { type: "string" },
      json: { type: "boolean", default: false },
      "no-private-keys": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const wordCount = values.strength === "24" ? 256 : 128;

  return {
    strength: wordCount,
    mnemonic: values.mnemonic,
    json: values.json ?? false,
    noPrivateKeys: values["no-private-keys"] ?? false,
  };
}

function printHuman(w: Awaited<ReturnType<typeof generateMerchantWallets>>, hidePrivate: boolean) {
  const banner = "=".repeat(72);
  console.log(banner);
  console.log("PincerPay non-custodial wallet bootstrap");
  console.log(banner);
  console.log("");
  console.log("Mnemonic (save this — recovery is impossible without it):");
  console.log(`  ${w.mnemonic}`);
  console.log("");
  console.log("Solana (Phantom-compatible)");
  console.log(`  Address:        ${w.solana.address}`);
  console.log(`  Derivation:     ${w.solana.derivationPath}`);
  if (!hidePrivate) {
    console.log(`  Private key:    ${w.solana.privateKey}`);
  }
  console.log("");
  console.log("EVM (MetaMask-compatible — Polygon, Base, Ethereum)");
  console.log(`  Address:        ${w.evm.address}`);
  console.log(`  Derivation:     ${w.evm.derivationPath}`);
  if (!hidePrivate) {
    console.log(`  Private key:    ${w.evm.privateKey}`);
  }
  console.log("");
  console.log(banner);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Copy the mnemonic into a password manager.");
  console.log("  2. Import into Phantom (Solana) and MetaMask (EVM) if you want a UI.");
  console.log("  3. Use the addresses as PINCERPAY_MERCHANT_ADDRESS_SOLANA / _POLYGON.");
  console.log("  4. Fund the addresses with devnet/testnet USDC for testing.");
}

async function main() {
  const args = parse();

  const wallets = await generateMerchantWallets({
    strength: args.strength,
    mnemonic: args.mnemonic,
  });

  if (args.json) {
    if (args.noPrivateKeys) {
      const { solana, evm, mnemonic } = wallets;
      console.log(
        JSON.stringify(
          {
            mnemonic,
            solana: { address: solana.address, derivationPath: solana.derivationPath },
            evm: { address: evm.address, derivationPath: evm.derivationPath },
          },
          null,
          2,
        ),
      );
    } else {
      console.log(JSON.stringify(wallets, null, 2));
    }
    return;
  }

  printHuman(wallets, args.noPrivateKeys);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
