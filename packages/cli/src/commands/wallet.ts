import { createClient } from "../lib/api.js";
import { confirm } from "../lib/prompts.js";

interface MerchantResponse {
  merchantId: string;
  name: string;
  walletAddress: string;
  supportedChains: string[];
  webhookUrl: string | null;
}

export interface WalletSetOptions {
  solana?: string;
  evm?: string;
  force?: boolean;
}

function ensureAuth() {
  const client = createClient();
  if (!client.authenticated) {
    console.error("Not logged in. Run `pincerpay login` first.");
    process.exit(1);
  }
  return client;
}

export async function runWalletSet(options: WalletSetOptions): Promise<void> {
  const client = ensureAuth();
  const merchant = await client.request<MerchantResponse>("GET", "/v1/onboarding/merchant");

  if (!options.solana && !options.evm) {
    console.error("Provide at least one of --solana or --evm.");
    process.exit(1);
  }

  if (!options.force && merchant.walletAddress) {
    console.log(`Current primary wallet: ${merchant.walletAddress}`);
    const ok = await confirm(
      "Changing wallet addresses redirects all future settlements to the new addresses.\n  Continue?",
      false,
    );
    if (!ok) {
      console.log("Cancelled.");
      return;
    }
  }

  const walletAddresses: Record<string, string> = {};
  if (options.solana) walletAddresses.solana = options.solana;
  if (options.evm) walletAddresses.evm = options.evm;

  await client.request("PATCH", "/v1/onboarding/merchant", { walletAddresses });

  console.log("✓ Wallet addresses updated.");
  console.log("  An email notification has been logged in the audit trail.");
  if (options.solana) console.log(`  Solana: ${options.solana}`);
  if (options.evm) console.log(`  EVM:    ${options.evm}`);
}
