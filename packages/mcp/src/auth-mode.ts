import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves which auth mode the MCP server should operate in for onboarding
 * tools. Three-way fallback:
 *
 *   1. DATABASE_URL set        -> "admin"  (direct DB writes via @pincerpay/onboarding)
 *   2. ~/.pincerpay/credentials.json valid -> "public" (HTTP API via Bearer token)
 *   3. neither                 -> "none"   (return helpful error to caller)
 */

export interface PublicCredentials {
  facilitatorUrl: string;
  accessToken: string;
  email: string;
  expiresAt: string;
}

export type AuthMode =
  | { mode: "admin"; databaseUrl: string }
  | { mode: "public"; credentials: PublicCredentials }
  | { mode: "none" };

const ERROR_MESSAGE =
  "No PincerPay authentication available. Two options:\n" +
  "  1. Public usage: run `npx @pincerpay/cli signup` (or `login`) in a terminal " +
  "to authenticate, then retry.\n" +
  "  2. Self-hosted / admin: set DATABASE_URL on the MCP server to use direct " +
  "DB access.";

export function resolveAuthMode(): AuthMode {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return { mode: "admin", databaseUrl };
  }

  const path = join(homedir(), ".pincerpay", "credentials.json");
  try {
    statSync(path);
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as PublicCredentials & { savedAt?: string };
    if (
      typeof parsed.facilitatorUrl !== "string" ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return { mode: "none" };
    }
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      // Expired — treat as no credentials.
      return { mode: "none" };
    }
    return {
      mode: "public",
      credentials: {
        facilitatorUrl: parsed.facilitatorUrl,
        accessToken: parsed.accessToken,
        email: parsed.email ?? "",
        expiresAt: parsed.expiresAt,
      },
    };
  } catch {
    return { mode: "none" };
  }
}

export function authModeErrorMessage(): string {
  return ERROR_MESSAGE;
}
