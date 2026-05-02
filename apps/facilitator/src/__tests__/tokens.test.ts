import { describe, it, expect, beforeAll } from "vitest";
import { mintCliToken, parseToken, hashToken } from "../lib/tokens.js";

beforeAll(() => {
  process.env.TOKEN_PEPPER = "test-pepper-must-be-at-least-32-chars-long-yes";
});

describe("CLI tokens", () => {
  it("mints a token with the pp_cli_ prefix", () => {
    const { rawToken, prefix } = mintCliToken();
    expect(rawToken.startsWith("pp_cli_")).toBe(true);
    expect(prefix).toBe(rawToken.slice(0, 14));
  });

  it("hashes the token deterministically with the pepper", () => {
    const { rawToken, hash } = mintCliToken();
    expect(hashToken(rawToken)).toBe(hash);
  });

  it("parses a freshly-minted token successfully", () => {
    const { rawToken, hash, prefix } = mintCliToken();
    const parsed = parseToken(rawToken);
    expect(parsed.ok).toBe(true);
    expect(parsed.hash).toBe(hash);
    expect(parsed.prefix).toBe(prefix);
  });

  it("rejects a token with the wrong prefix", () => {
    const parsed = parseToken("pp_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("format");
  });

  it("rejects a token whose checksum doesn't match", () => {
    const { rawToken } = mintCliToken();
    // Corrupt the last char of the checksum.
    const corrupted = rawToken.slice(0, -1) + (rawToken.endsWith("0") ? "1" : "0");
    const parsed = parseToken(corrupted);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("checksum");
  });

  it("rejects a token with non-base32 chars", () => {
    const parsed = parseToken("pp_cli_!@#$%^&*()1234567890123456789012345");
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("format");
  });

  it("hashes with a different pepper produce different hashes", () => {
    const { rawToken, hash: hash1 } = mintCliToken();
    process.env.TOKEN_PEPPER = "different-pepper-must-be-at-least-32-chars-here";
    const hash2 = hashToken(rawToken);
    expect(hash1).not.toBe(hash2);
    process.env.TOKEN_PEPPER = "test-pepper-must-be-at-least-32-chars-long-yes";
  });
});
