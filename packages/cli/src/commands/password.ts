import { createClient } from "../lib/api.js";
import { loadCredentials } from "../lib/credentials.js";
import { prompt, promptPassword } from "../lib/prompts.js";

export async function runRecover(emailFlag: string | undefined): Promise<void> {
  const client = createClient();
  const email = emailFlag ?? (await prompt("Email: "));
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }
  await client.request("POST", "/v1/onboarding/auth/recover", { email });
  console.log(`If an account exists for ${email}, a recovery code has been sent.`);
  console.log("Run `pincerpay reset-password` and paste the code from your inbox.");
}

export async function runResetPassword(emailFlag: string | undefined): Promise<void> {
  const client = createClient();
  const email = emailFlag ?? (await prompt("Email: "));
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }
  const token = await prompt("Recovery code: ");
  if (!token) {
    console.error("Recovery code is required.");
    process.exit(1);
  }
  const newPassword = await promptPassword("New password (8+ chars): ");
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const confirmPw = await promptPassword("Confirm password: ");
  if (confirmPw !== newPassword) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  await client.request("POST", "/v1/onboarding/auth/reset-password", {
    email,
    token,
    newPassword,
  });
  console.log("✓ Password reset.");
  console.log("Now run `pincerpay login` to sign in with the new password.");
}

export async function runChangePassword(): Promise<void> {
  const creds = loadCredentials();
  if (!creds) {
    console.error("Not logged in. Run `pincerpay login` first.");
    process.exit(1);
  }
  const client = createClient();
  const currentPassword = await promptPassword("Current password: ");
  const newPassword = await promptPassword("New password (8+ chars): ");
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const confirmPw = await promptPassword("Confirm new password: ");
  if (confirmPw !== newPassword) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  await client.request("POST", "/v1/onboarding/auth/change-password", {
    email: creds.email,
    currentPassword,
    newPassword,
  });
  console.log("✓ Password changed.");
  console.log("All other sessions for this account have been revoked.");
}
