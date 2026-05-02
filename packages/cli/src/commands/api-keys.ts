import { createClient } from "../lib/api.js";

interface CreateResponse {
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
  createdAt: string;
}

interface ListResponse {
  keys: Array<{
    id: string;
    prefix: string;
    label: string;
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

export async function runCreateApiKey(label: string | undefined): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<CreateResponse>(
    "POST",
    "/v1/onboarding/api-keys",
    { label: label ?? "default" },
  );
  console.log(`✓ Created API key (${res.label})`);
  console.log(`  Prefix: ${res.prefix}`);
  console.log();
  console.log(res.rawKey);
  console.log();
  console.log("Save this key now. It is never shown again.");
}

export async function runListApiKeys(): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<ListResponse>("GET", "/v1/onboarding/api-keys");
  if (res.keys.length === 0) {
    console.log("No API keys.");
    return;
  }
  for (const k of res.keys) {
    const status = k.isActive ? "active" : "revoked";
    const lastUsed = k.lastUsedAt
      ? `last used ${new Date(k.lastUsedAt).toLocaleString()}`
      : "never used";
    console.log(`${k.id}  ${k.prefix}...  ${k.label.padEnd(20)}  ${status}  ${lastUsed}`);
  }
}

export async function runRotateApiKey(id: string): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<RotateResponse>(
    "POST",
    `/v1/onboarding/api-keys/${encodeURIComponent(id)}/rotate`,
  );
  console.log(`✓ Rotated API key`);
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
