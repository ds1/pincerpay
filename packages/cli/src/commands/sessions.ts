import { createClient } from "../lib/api.js";

interface ListSessionsResponse {
  sessions: Array<{
    id: string;
    prefix: string;
    label: string;
    clientName: string | null;
    clientIpFirst: string | null;
    clientIpLast: string | null;
    isCurrent: boolean;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
  }>;
}

function ensureAuth() {
  const client = createClient();
  if (!client.authenticated) {
    console.error("Not logged in. Run `pincerpay login` first.");
    process.exit(1);
  }
  return client;
}

export async function runListSessions(): Promise<void> {
  const client = ensureAuth();
  const res = await client.request<ListSessionsResponse>("GET", "/v1/onboarding/sessions");
  if (res.sessions.length === 0) {
    console.log("No active sessions.");
    return;
  }
  for (const s of res.sessions) {
    const tag = s.isCurrent ? " [current]" : "";
    const lastUsed = s.lastUsedAt
      ? new Date(s.lastUsedAt).toLocaleString()
      : "never used";
    const ip = s.clientIpLast ?? s.clientIpFirst ?? "unknown ip";
    console.log(`${s.id}${tag}`);
    console.log(`  ${s.prefix}...  ${s.label}`);
    console.log(`  ${s.clientName ?? "unknown client"} from ${ip}`);
    console.log(`  Last used: ${lastUsed}  (expires ${new Date(s.expiresAt).toLocaleString()})`);
    console.log();
  }
}

export async function runRevokeSession(id: string): Promise<void> {
  const client = ensureAuth();
  await client.request("DELETE", `/v1/onboarding/sessions/${encodeURIComponent(id)}`);
  console.log(`✓ Revoked session ${id}.`);
}
