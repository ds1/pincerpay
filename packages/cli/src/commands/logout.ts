import { createClient, ApiError } from "../lib/api.js";
import { deleteCredentials, loadCredentials } from "../lib/credentials.js";

export async function runLogout(): Promise<void> {
  const creds = loadCredentials();
  if (!creds) {
    console.log("Already logged out (no credentials file).");
    return;
  }

  const client = createClient();

  try {
    await client.request("DELETE", "/v1/onboarding/sessions/me");
    console.log("✓ Server-side session revoked.");
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      // Token already invalid — nothing to revoke server-side.
    } else {
      console.warn(
        "⚠ Server-side revoke failed; deleting local credentials anyway. " +
          "Visit https://pincerpay.com/dashboard/settings/security to fully revoke.",
      );
      console.warn(`  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (deleteCredentials()) {
    console.log("✓ Local credentials removed.");
  }
}
