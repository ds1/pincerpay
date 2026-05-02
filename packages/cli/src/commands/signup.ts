import { createClient } from "../lib/api.js";
import { saveCredentials, describeCredentialsLocation } from "../lib/credentials.js";
import { prompt, promptPassword } from "../lib/prompts.js";

export interface SignupOptions {
  email?: string;
  facilitatorUrl?: string;
}

interface SignupResponse {
  status: string;
  autoConfirmed: boolean;
  accessToken?: string;
  expiresAt?: string;
  prefix?: string;
  authUserId?: string;
  email?: string;
}

interface VerifyResponse {
  status: string;
  accessToken: string;
  expiresAt: string;
  prefix: string;
  authUserId: string;
  email: string;
}

export async function runSignup(options: SignupOptions): Promise<void> {
  const client = createClient({ facilitatorUrl: options.facilitatorUrl });

  const email = options.email ?? (await prompt("Email: "));
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }
  const password = await promptPassword("Password (8+ chars): ");
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const confirmPw = await promptPassword("Confirm password: ");
  if (confirmPw !== password) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const signupRes = await client.request<SignupResponse>(
    "POST",
    "/v1/onboarding/auth/signup",
    { email, password },
  );

  // Auto-confirmed projects skip the OTP step.
  if (signupRes.autoConfirmed && signupRes.accessToken && signupRes.expiresAt) {
    saveCredentials({
      facilitatorUrl: client.baseUrl,
      accessToken: signupRes.accessToken,
      prefix: signupRes.prefix ?? "",
      authUserId: signupRes.authUserId ?? "",
      email,
      expiresAt: signupRes.expiresAt,
      savedAt: new Date().toISOString(),
    });
    console.log(`\n✓ Signed up as ${email}.`);
    console.log(`  Credentials saved to ${describeCredentialsLocation()}.`);
    console.log(`  Token expires ${new Date(signupRes.expiresAt).toLocaleString()}.`);
    return;
  }

  console.log(`\nWe sent a verification code to ${email}.`);
  console.log(`Check your inbox and paste the code below.\n`);
  const token = await prompt("Verification code: ");
  if (!token) {
    console.error("Code is required.");
    process.exit(1);
  }

  const verifyRes = await client.request<VerifyResponse>(
    "POST",
    "/v1/onboarding/auth/verify-email",
    { email, token },
  );

  saveCredentials({
    facilitatorUrl: client.baseUrl,
    accessToken: verifyRes.accessToken,
    prefix: verifyRes.prefix,
    authUserId: verifyRes.authUserId,
    email: verifyRes.email,
    expiresAt: verifyRes.expiresAt,
    savedAt: new Date().toISOString(),
  });

  console.log(`\n✓ Verified and signed in as ${verifyRes.email}.`);
  console.log(`  Credentials saved to ${describeCredentialsLocation()}.`);
  console.log(`  Token expires ${new Date(verifyRes.expiresAt).toLocaleString()}.`);
  console.log(`\nNext: run \`pincerpay bootstrap-merchant\` to create your merchant profile.`);
}
