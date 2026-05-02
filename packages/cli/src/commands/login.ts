import { createClient } from "../lib/api.js";
import { saveCredentials, describeCredentialsLocation } from "../lib/credentials.js";
import { prompt, promptPassword } from "../lib/prompts.js";

export interface LoginOptions {
  email?: string;
  facilitatorUrl?: string;
}

interface LoginResponse {
  status: string;
  accessToken: string;
  expiresAt: string;
  prefix: string;
  authUserId: string;
  email: string;
}

export async function runLogin(options: LoginOptions): Promise<void> {
  const client = createClient({ facilitatorUrl: options.facilitatorUrl });

  const email = options.email ?? (await prompt("Email: "));
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }
  const password = await promptPassword("Password: ");
  if (!password) {
    console.error("Password is required.");
    process.exit(1);
  }

  const res = await client.request<LoginResponse>(
    "POST",
    "/v1/onboarding/auth/login",
    { email, password },
  );

  saveCredentials({
    facilitatorUrl: client.baseUrl,
    accessToken: res.accessToken,
    prefix: res.prefix,
    authUserId: res.authUserId,
    email: res.email,
    expiresAt: res.expiresAt,
    savedAt: new Date().toISOString(),
  });

  console.log(`✓ Logged in as ${res.email}.`);
  console.log(`  Credentials saved to ${describeCredentialsLocation()}.`);
  console.log(`  Token expires ${new Date(res.expiresAt).toLocaleString()}.`);
}
