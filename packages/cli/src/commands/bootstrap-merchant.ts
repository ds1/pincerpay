import { generateMerchantWallets } from "@pincerpay/onboarding";
import { createClient } from "../lib/api.js";

export interface BootstrapMerchantOptions {
  name: string;
  chains?: string[];
  webhookUrl?: string;
  apiKeyLabel?: string;
  mnemonic?: string;
  strength?: 12 | 24;
  skipApiKey?: boolean;
}

interface BootstrapResponse {
  merchantId: string;
  name: string;
  walletAddress: string;
  supportedChains: string[];
  webhookUrl: string | null;
  isNew: boolean;
}

interface CreateApiKeyResponse {
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
}

export async function runBootstrapMerchant(options: BootstrapMerchantOptions): Promise<void> {
  const client = createClient();
  if (!client.authenticated) {
    console.error("Not logged in. Run `pincerpay login` or `pincerpay signup` first.");
    process.exit(1);
  }

  const chains = options.chains ?? ["solana", "polygon"];

  // 1. Generate non-custodial wallets locally.
  const wallets = await generateMerchantWallets({
    strength: options.strength === 24 ? 256 : 128,
    mnemonic: options.mnemonic,
  });

  // 2. Bootstrap merchant on the facilitator (find-or-create).
  const merchant = await client.request<BootstrapResponse>(
    "POST",
    "/v1/onboarding/merchant/bootstrap",
    {
      name: options.name,
      walletAddresses: { solana: wallets.solana.address, evm: wallets.evm.address },
      supportedChains: chains,
      webhookUrl: options.webhookUrl,
    },
  );

  // 3. Mint an initial API key (unless already done).
  let apiKey: CreateApiKeyResponse | null = null;
  if (!options.skipApiKey) {
    apiKey = await client.request<CreateApiKeyResponse>(
      "POST",
      "/v1/onboarding/api-keys",
      { label: options.apiKeyLabel ?? "default" },
    );
  }

  // 4. Print env-var-ready output.
  const banner = "=".repeat(72);
  console.log(banner);
  console.log(`PincerPay merchant ${merchant.isNew ? "created" : "found"} — ${merchant.name}`);
  console.log(banner);
  console.log();
  console.log(`Merchant id:    ${merchant.merchantId}`);
  console.log(`Chains:         ${merchant.supportedChains.join(", ")}`);
  console.log();
  console.log("--- Save the following — none of it is recoverable ---");
  console.log();
  console.log("Mnemonic (seed phrase for both chains):");
  console.log(`  ${wallets.mnemonic}`);
  console.log();
  console.log("Solana wallet (Phantom-compatible)");
  console.log(`  Address:      ${wallets.solana.address}`);
  console.log(`  Private key:  ${wallets.solana.privateKey}`);
  console.log();
  console.log("EVM wallet (MetaMask-compatible — Polygon, Base, Ethereum)");
  console.log(`  Address:      ${wallets.evm.address}`);
  console.log(`  Private key:  ${wallets.evm.privateKey}`);
  console.log();
  if (apiKey) {
    console.log("API key (raw — store as PINCERPAY_API_KEY):");
    console.log(`  ${apiKey.rawKey}`);
    console.log();
  }
  console.log(banner);
  console.log("Env vars block (copy into .env or `vercel env add`):");
  console.log(banner);
  console.log();
  if (apiKey) console.log(`PINCERPAY_API_KEY=${apiKey.rawKey}`);
  console.log(`PINCERPAY_MERCHANT_ADDRESS_SOLANA=${wallets.solana.address}`);
  console.log(`PINCERPAY_MERCHANT_ADDRESS_POLYGON=${wallets.evm.address}`);
  console.log();

  if (!merchant.isNew) {
    console.log("⚠ Merchant already existed. Wallet addresses on the merchant record are NOT");
    console.log("  changed by bootstrap. To rotate wallets, use `pincerpay wallet set`.");
  }
}
