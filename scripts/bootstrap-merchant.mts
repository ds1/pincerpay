import { parseArgs } from "node:util";
import { generateMerchantWallets, bootstrapMerchant } from "@pincerpay/onboarding";

const USAGE = `
Usage:
  DATABASE_URL=postgresql://... pnpm bootstrap-merchant [flags]

Required flags:
  --name "<name>"            Display name for the merchant
  --auth-user-id <uuid>      Supabase Auth user id that owns this merchant

Optional flags:
  --mnemonic "<...>"         Use an existing mnemonic instead of generating one
  --strength 12|24           Mnemonic word count when generating (default 12)
  --webhook-url <url>        Webhook delivery URL
  --label "<label>"          API key label (default "Bootstrap")
  --chains <list>            Comma-separated supported chains (default "solana,polygon")
  --json                     Emit machine-readable JSON instead of human text
  --dry-run                  Generate wallets but skip DB inserts
  --help                     Show this message

End-to-end merchant onboarding for PincerPay. Generates non-custodial wallets,
inserts a merchant row, and provisions an API key in a single command.

The mnemonic, private keys, raw API key, and webhook secret are printed once.
PincerPay never persists private material. Save everything somewhere durable
before closing this terminal.

Output includes ready-to-paste env vars for the merchant's app:

  PINCERPAY_API_KEY=pp_live_...
  PINCERPAY_MERCHANT_ADDRESS_SOLANA=...
  PINCERPAY_MERCHANT_ADDRESS_POLYGON=...
  PINCERPAY_WEBHOOK_SECRET=...
`.trim();

interface Args {
  name: string;
  authUserId: string;
  mnemonic?: string;
  strength: 128 | 256;
  webhookUrl?: string;
  label: string;
  chains: string[];
  json: boolean;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parse(): Args {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string" },
      "auth-user-id": { type: "string" },
      mnemonic: { type: "string" },
      strength: { type: "string", default: "12" },
      "webhook-url": { type: "string" },
      label: { type: "string", default: "Bootstrap" },
      chains: { type: "string", default: "solana,polygon" },
      json: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!values.name) fail("--name is required");
  if (!values["auth-user-id"]) fail("--auth-user-id is required");

  return {
    name: values.name,
    authUserId: values["auth-user-id"],
    mnemonic: values.mnemonic,
    strength: values.strength === "24" ? 256 : 128,
    webhookUrl: values["webhook-url"],
    label: values.label ?? "Bootstrap",
    chains: (values.chains ?? "solana,polygon").split(",").map((s) => s.trim()),
    json: values.json ?? false,
    dryRun: values["dry-run"] ?? false,
  };
}

function printHuman(args: Args, result: Awaited<ReturnType<typeof bootstrapMerchant>>) {
  const w = result.wallets!;
  const banner = "=".repeat(72);

  console.log(banner);
  console.log(`PincerPay merchant bootstrap — ${args.name}`);
  console.log(banner);
  console.log("");
  console.log(`Merchant id:    ${result.merchantId}`);
  console.log(`Auth user id:   ${args.authUserId}`);
  console.log(`API key label:  ${result.apiKey.label}`);
  console.log(`API key prefix: ${result.apiKey.prefix}`);
  console.log("");
  console.log("--- Save the following — none of it is recoverable ---");
  console.log("");
  console.log("Mnemonic (seed phrase for both chains):");
  console.log(`  ${w.mnemonic}`);
  console.log("");
  console.log("Solana wallet (Phantom-compatible)");
  console.log(`  Address:      ${w.solana.address}`);
  console.log(`  Private key:  ${w.solana.privateKey}`);
  console.log(`  Derivation:   ${w.solana.derivationPath}`);
  console.log("");
  console.log("EVM wallet (MetaMask-compatible — Polygon, Base, Ethereum)");
  console.log(`  Address:      ${w.evm.address}`);
  console.log(`  Private key:  ${w.evm.privateKey}`);
  console.log(`  Derivation:   ${w.evm.derivationPath}`);
  console.log("");
  console.log("API key (raw — store as PINCERPAY_API_KEY):");
  console.log(`  ${result.apiKey.rawKey}`);
  console.log("");
  console.log("Webhook secret (HMAC-SHA256 — store as PINCERPAY_WEBHOOK_SECRET):");
  console.log(`  ${result.webhookSecret}`);
  console.log("");
  console.log(banner);
  console.log("Env vars block (copy into .env or `vercel env add`):");
  console.log(banner);
  console.log("");
  console.log(`PINCERPAY_API_KEY=${result.apiKey.rawKey}`);
  console.log(`PINCERPAY_MERCHANT_ADDRESS_SOLANA=${w.solana.address}`);
  console.log(`PINCERPAY_MERCHANT_ADDRESS_POLYGON=${w.evm.address}`);
  console.log(`PINCERPAY_WEBHOOK_SECRET=${result.webhookSecret}`);
  console.log("");
}

async function main() {
  const args = parse();

  if (args.dryRun) {
    const wallets = await generateMerchantWallets({
      strength: args.strength,
      mnemonic: args.mnemonic,
    });
    if (args.json) {
      console.log(JSON.stringify({ dryRun: true, wallets, args }, null, 2));
      return;
    }
    console.log("[dry-run] generated wallets, skipping DB inserts");
    console.log("");
    console.log("Mnemonic:", wallets.mnemonic);
    console.log("Solana:  ", wallets.solana.address);
    console.log("EVM:     ", wallets.evm.address);
    return;
  }

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  const wallets = await generateMerchantWallets({
    strength: args.strength,
    mnemonic: args.mnemonic,
  });

  const result = await bootstrapMerchant({
    databaseUrl: process.env.DATABASE_URL,
    name: args.name,
    authUserId: args.authUserId,
    wallets,
    walletAddresses: { solana: wallets.solana.address, evm: wallets.evm.address },
    supportedChains: args.chains,
    webhookUrl: args.webhookUrl,
    apiKeyLabel: args.label,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHuman(args, result);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
