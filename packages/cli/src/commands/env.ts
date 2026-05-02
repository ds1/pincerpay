import { createClient } from "../lib/api.js";

interface MerchantResponse {
  merchantId: string;
  name: string;
  walletAddress: string;
  supportedChains: string[];
}

interface ListResponse {
  keys: Array<{
    id: string;
    prefix: string;
    label: string;
    isActive: boolean;
  }>;
}

/**
 * Print an env-var template based on the current merchant config. Does NOT
 * include raw secrets — those were shown once at creation time and must come
 * from the user's password manager.
 */
export async function runEnv(): Promise<void> {
  const client = createClient();
  if (!client.authenticated) {
    console.error("Not logged in. Run `pincerpay login` first.");
    process.exit(1);
  }

  const merchant = await client.request<MerchantResponse>("GET", "/v1/onboarding/merchant");
  const keys = await client.request<ListResponse>("GET", "/v1/onboarding/api-keys");
  const activeKey = keys.keys.find((k) => k.isActive);

  console.log("# Env vars for your merchant app");
  console.log(`# Merchant: ${merchant.name} (${merchant.merchantId})`);
  console.log();
  console.log(`PINCERPAY_MERCHANT_ADDRESS_SOLANA=${merchant.walletAddress}`);
  if (merchant.supportedChains.includes("polygon") || merchant.supportedChains.includes("base")) {
    console.log(`PINCERPAY_MERCHANT_ADDRESS_POLYGON=<set me — see your password manager>`);
  }
  if (activeKey) {
    console.log(`PINCERPAY_API_KEY=${activeKey.prefix}...  # Get the full key from your password manager`);
  } else {
    console.log(`PINCERPAY_API_KEY=  # No active keys. Run \`pincerpay api-keys create\`.`);
  }
  console.log();
  console.log("# Raw API keys are shown only once at creation time.");
  console.log("# To rotate: `pincerpay api-keys rotate <id>`.");
}
