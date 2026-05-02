import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface Credentials {
  facilitatorUrl: string;
  accessToken: string;
  prefix: string;
  authUserId: string;
  email: string;
  expiresAt: string;
  /** Local timestamp the credentials were saved (ISO). */
  savedAt: string;
}

function credentialsDir(): string {
  return join(homedir(), ".pincerpay");
}

function credentialsPath(): string {
  return join(credentialsDir(), "credentials.json");
}

function ensureDir(): void {
  try {
    mkdirSync(credentialsDir(), { recursive: true });
  } catch {
    // ignore
  }
}

/** Save credentials atomically (temp file + rename) with restrictive perms on POSIX. */
export function saveCredentials(creds: Credentials): void {
  ensureDir();
  const path = credentialsPath();
  const tmp = `${path}.${process.pid}.tmp`;
  const json = JSON.stringify(creds, null, 2) + "\n";
  writeFileSync(tmp, json, { encoding: "utf8" });
  if (platform() !== "win32") {
    try {
      chmodSync(tmp, 0o600);
    } catch {
      // ignore — best effort
    }
  }
  renameSync(tmp, path);
}

export function loadCredentials(): Credentials | null {
  try {
    const raw = readFileSync(credentialsPath(), "utf8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function deleteCredentials(): boolean {
  try {
    unlinkSync(credentialsPath());
    return true;
  } catch {
    return false;
  }
}

export function credentialsExist(): boolean {
  try {
    statSync(credentialsPath());
    return true;
  } catch {
    return false;
  }
}

/** True if credentials are present and not expired. */
export function credentialsValid(): boolean {
  const c = loadCredentials();
  if (!c) return false;
  return new Date(c.expiresAt).getTime() > Date.now();
}

export function describeCredentialsLocation(): string {
  return credentialsPath();
}
