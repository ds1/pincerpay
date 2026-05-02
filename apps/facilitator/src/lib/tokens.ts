import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "pp_cli_";
const ENTROPY_BYTES = 24;
const CHECKSUM_BYTES = 4;

const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstuvwxyz";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function checksum(prefix: string, body: string, pepper: string): string {
  const mac = createHmac("sha256", pepper).update(prefix + body).digest();
  return encodeBase32(mac).slice(0, CHECKSUM_BYTES);
}

function getPepper(): string {
  const pepper = process.env.TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error(
      "TOKEN_PEPPER env var must be set and at least 32 chars. Generate one with `openssl rand -base64 48`.",
    );
  }
  return pepper;
}

export interface MintedToken {
  /** The raw token to return to the caller. Shown once, never recoverable. */
  rawToken: string;
  /** HMAC-SHA256 hash for DB storage. */
  hash: string;
  /** First 14 chars (e.g. "pp_cli_abcd12") for human display. */
  prefix: string;
}

/**
 * Mint a new CLI bearer token. The format is:
 *   pp_cli_<entropy-base32><checksum-base32>
 * where checksum = HMAC-SHA256(pepper, prefix + entropy)[:4 bytes].
 *
 * Stored as HMAC-SHA256(pepper, raw_token).
 */
export function mintCliToken(): MintedToken {
  const pepper = getPepper();
  const entropy = encodeBase32(randomBytes(ENTROPY_BYTES));
  const cksum = checksum(TOKEN_PREFIX, entropy, pepper);
  const rawToken = TOKEN_PREFIX + entropy + cksum;
  const hash = hashToken(rawToken);
  const prefix = rawToken.slice(0, 14);
  return { rawToken, hash, prefix };
}

/** HMAC-SHA256 of the raw token. Used for DB lookup. */
export function hashToken(rawToken: string): string {
  const pepper = getPepper();
  return createHmac("sha256", pepper).update(rawToken).digest("hex");
}

export interface ParsedToken {
  ok: boolean;
  reason?: "format" | "checksum";
  hash?: string;
  prefix?: string;
}

/**
 * Validate format + checksum of a raw token. Cheap pre-DB-lookup check that
 * gives a friendlier error than a generic 401 when the user fat-fingers.
 */
export function parseToken(rawToken: string): ParsedToken {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return { ok: false, reason: "format" };
  const body = rawToken.slice(TOKEN_PREFIX.length);
  // entropy is 24 bytes -> ceil(24*8/5) = 39 base32 chars; checksum is 4 chars
  if (body.length !== 39 + CHECKSUM_BYTES) return { ok: false, reason: "format" };
  for (const c of body) {
    if (!BASE32_ALPHABET.includes(c)) return { ok: false, reason: "format" };
  }
  const entropy = body.slice(0, 39);
  const provided = body.slice(39);
  const pepper = getPepper();
  const expected = checksum(TOKEN_PREFIX, entropy, pepper);
  // timing-safe compare (both 4 ASCII chars; lengths match by construction)
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "checksum" };
  }
  return {
    ok: true,
    hash: hashToken(rawToken),
    prefix: rawToken.slice(0, 14),
  };
}

/**
 * Plain SHA-256 hash. Reused for backwards-compat with the existing api_keys
 * table which still uses sha256(rawKey). Only use here for completeness; new
 * code should use {@link hashToken}.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
