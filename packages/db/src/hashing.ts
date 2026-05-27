import { createHash, createHmac } from "node:crypto";

/**
 * API key hashing helpers, shared by every site that mints or verifies a
 * `pp_live_*` / `pp_test_*` key (facilitator middleware + onboarding route,
 * dashboard server actions, CLI bootstrap).
 *
 * Two schemes coexist during the migration tracked in #124:
 *   - legacy: plain SHA-256 of the raw key, stored in `api_keys.key_hash`.
 *   - current: HMAC-SHA256 with the server pepper (the same TOKEN_PEPPER used
 *     for cli_sessions), stored in `api_keys.key_hash_hmac`.
 *
 * New keys are hashed with HMAC when a pepper is available; verification tries
 * HMAC first and falls back to SHA-256 so existing keys keep working until the
 * cutover cleanup revokes them.
 */

/** HMAC-SHA256(pepper, rawKey) as hex. Use for all newly minted keys. */
export function apiKeyHashHmac(rawKey: string, pepper: string): string {
  return createHmac("sha256", pepper).update(rawKey).digest("hex");
}

/** Legacy plain SHA-256(rawKey) as hex. Kept only for fallback verification. */
export function apiKeyHashSha256(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Minimum pepper length (matches the facilitator's TOKEN_PEPPER validation). */
const MIN_PEPPER_LENGTH = 32;

/**
 * Read a usable token pepper from the environment, or null when none is
 * configured. Callers fall back to legacy SHA-256 hashing when this is null so
 * key creation never hard-fails in a deployment that has not yet set the pepper.
 */
export function getApiKeyPepper(env: NodeJS.ProcessEnv = process.env): string | null {
  const pepper = env.TOKEN_PEPPER;
  if (!pepper || pepper.length < MIN_PEPPER_LENGTH) return null;
  return pepper;
}

export interface MintedApiKeyHash {
  /** Value for `api_keys.key_hash_hmac` (null when no pepper is configured). */
  keyHashHmac: string | null;
  /** Value for `api_keys.key_hash` (null when hashed with HMAC). */
  keyHash: string | null;
}

/**
 * Compute the hash columns for a freshly minted key. Prefers HMAC when a pepper
 * is configured; otherwise writes the legacy SHA-256 column so the key remains
 * usable. Exactly one of the two columns is non-null.
 */
export function hashNewApiKey(
  rawKey: string,
  env: NodeJS.ProcessEnv = process.env,
): MintedApiKeyHash {
  const pepper = getApiKeyPepper(env);
  if (pepper) {
    return { keyHashHmac: apiKeyHashHmac(rawKey, pepper), keyHash: null };
  }
  return { keyHashHmac: null, keyHash: apiKeyHashSha256(rawKey) };
}
