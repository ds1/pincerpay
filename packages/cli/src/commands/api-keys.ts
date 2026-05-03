import { createClient } from "../lib/api.js";

type Environment = "live" | "test";

interface CreateResponse {
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
  environment: Environment;
  createdAt: string;
}

interface ListResponse {
  keys: Array<{
    id: string;
    prefix: string;
    label: string;
    environment: Environment;
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
}

interface RotateResponse extends CreateResponse {
  revokedKeyId: string;
}

function ensureAuth() {
  const client = createClient();
  if (!client.authenticated) {
    console.error("Not logged in. Run `pincerpay login` first.");
    process.exit(1);
  }
  return client;
}

export async function runCreateApiKey(
  label: string | undefined,
  opts?: { isTest?: boolean },
): Promise<void> {
  const client = ensureAuth();
  const isTest = !!opts?.isTest;
  const res = await client.request<CreateResponse>(
    "POST",
    "/v1/onboarding/api-keys",
    { label: label ?? (isTest ? "test" : "default"), isTest },
  );
  const envBadge = res.environment === "test" ? "test" : "live";
  console.log(`✓ Created ${envBadge} API key (${res.label})`);
  console.log(`  Prefix: ${res.prefix}`);
  console.log();
  console.log(res.rawKey);
  console.log();
  if (res.environment === "test") {
    console.log("Test keys can only settle on testnet chains (e.g. solana-devnet).");
  }
  console.log("Save this key now. It is never shown again.");
}

export async function runListApiKeys(opts?: { env?: string }): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<ListResponse>("GET", "/v1/onboarding/api-keys");
  const envFilter = opts?.env === "live" || opts?.env === "test" ? opts.env : undefined;
  const keys = envFilter ? res.keys.filter((k) => k.environment === envFilter) : res.keys;
  if (keys.length === 0) {
    console.log(envFilter ? `No ${envFilter} API keys.` : "No API keys.");
    return;
  }
  for (const k of keys) {
    const status = k.isActive ? "active" : "revoked";
    const lastUsed = k.lastUsedAt
      ? `last used ${new Date(k.lastUsedAt).toLocaleString()}`
      : "never used";
    const envCol = k.environment.padEnd(4);
    console.log(`${k.id}  ${k.prefix}...  ${envCol}  ${k.label.padEnd(20)}  ${status}  ${lastUsed}`);
  }
}

export async function runRotateApiKey(id: string): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<RotateResponse>(
    "POST",
    `/v1/onboarding/api-keys/${encodeURIComponent(id)}/rotate`,
  );
  console.log(`✓ Rotated API key (${res.environment})`);
  console.log(`  Old key id:  ${res.revokedKeyId} (revoked)`);
  console.log(`  New key id:  ${res.id}`);
  console.log(`  Prefix:      ${res.prefix}`);
  console.log();
  console.log(res.rawKey);
  console.log();
  console.log("Save this key now. It is never shown again.");
}

export async function runRevokeApiKey(id: string): Promise<void> {
  const client = ensureAuth();
  await client.request("DELETE", `/v1/onboarding/api-keys/${encodeURIComponent(id)}`);
  console.log(`✓ Revoked API key ${id}.`);
}
