import { createClient } from "../lib/api.js";
import { loadCredentials } from "../lib/credentials.js";

interface HealthResponse {
  ok: boolean;
  authUserId: string;
  cliSessionId: string;
  scope: string;
  merchant: {
    id: string;
    name: string;
    walletAddress: string;
    supportedChains: string[];
  } | null;
}

export async function runWhoami(): Promise<void> {
  const creds = loadCredentials();
  if (!creds) {
    console.log("Not logged in. Run `pincerpay login` or `pincerpay signup`.");
    process.exit(1);
  }

  const client = createClient();
  const res = await client.request<HealthResponse>("GET", "/v1/onboarding/health");

  console.log(`Email:        ${creds.email}`);
  console.log(`Auth user id: ${res.authUserId}`);
  console.log(`Session:      ${creds.prefix}... (expires ${new Date(creds.expiresAt).toLocaleString()})`);
  console.log(`Facilitator:  ${client.baseUrl}`);
  if (res.merchant) {
    console.log(`Merchant:     ${res.merchant.name} (${res.merchant.id})`);
    console.log(`  Wallet:     ${res.merchant.walletAddress}`);
    console.log(`  Chains:     ${res.merchant.supportedChains.join(", ")}`);
  } else {
    console.log(`Merchant:     (none — run \`pincerpay bootstrap-merchant\` to create one)`);
  }
}
