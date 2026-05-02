import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempHome: string;

beforeEach(async () => {
  tempHome = mkdtempSync(join(tmpdir(), "pincerpay-cli-test-"));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
});

afterEach(() => {
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("credentials store", () => {
  it("save and load roundtrip preserves all fields", async () => {
    const mod = await import("../lib/credentials.js");
    mod.saveCredentials({
      facilitatorUrl: "https://test.pincerpay.com",
      accessToken: "pp_cli_test_token_12345",
      prefix: "pp_cli_test",
      authUserId: "00000000-0000-0000-0000-000000000001",
      email: "test@example.com",
      expiresAt: "2099-01-01T00:00:00Z",
      savedAt: "2026-05-02T00:00:00Z",
    });
    const loaded = mod.loadCredentials();
    expect(loaded).toEqual({
      facilitatorUrl: "https://test.pincerpay.com",
      accessToken: "pp_cli_test_token_12345",
      prefix: "pp_cli_test",
      authUserId: "00000000-0000-0000-0000-000000000001",
      email: "test@example.com",
      expiresAt: "2099-01-01T00:00:00Z",
      savedAt: "2026-05-02T00:00:00Z",
    });
  });

  it("loadCredentials returns null when no file exists", async () => {
    const mod = await import("../lib/credentials.js");
    expect(mod.loadCredentials()).toBeNull();
    expect(mod.credentialsExist()).toBe(false);
  });

  it("deleteCredentials removes the file", async () => {
    const mod = await import("../lib/credentials.js");
    mod.saveCredentials({
      facilitatorUrl: "https://test",
      accessToken: "x",
      prefix: "x",
      authUserId: "x",
      email: "x@x",
      expiresAt: "2099-01-01T00:00:00Z",
      savedAt: "2026-01-01T00:00:00Z",
    });
    expect(mod.credentialsExist()).toBe(true);
    expect(mod.deleteCredentials()).toBe(true);
    expect(mod.credentialsExist()).toBe(false);
  });

  it("credentialsValid is false for expired tokens", async () => {
    const mod = await import("../lib/credentials.js");
    mod.saveCredentials({
      facilitatorUrl: "https://test",
      accessToken: "x",
      prefix: "x",
      authUserId: "x",
      email: "x@x",
      expiresAt: "2000-01-01T00:00:00Z",
      savedAt: "2026-01-01T00:00:00Z",
    });
    expect(mod.credentialsValid()).toBe(false);
  });

  it("credentialsValid is true for non-expired tokens", async () => {
    const mod = await import("../lib/credentials.js");
    mod.saveCredentials({
      facilitatorUrl: "https://test",
      accessToken: "x",
      prefix: "x",
      authUserId: "x",
      email: "x@x",
      expiresAt: "2099-01-01T00:00:00Z",
      savedAt: "2026-01-01T00:00:00Z",
    });
    expect(mod.credentialsValid()).toBe(true);
  });
});
