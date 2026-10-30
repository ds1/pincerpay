import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../config.js";

const BASE_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  SOLANA_PRIVATE_KEY: "test-key",
};

describe("loadConfig boolean env vars", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function load(extra: Record<string, string>) {
    process.env = { ...BASE_ENV, ...extra };
    return loadConfig();
  }

  it.each([
    ["false", false],
    ["0", false],
    ["FALSE", false],
    ["true", true],
    ["1", true],
    ["TRUE", true],
  ])("parses SUPABASE_SMTP_CONFIGURED=%s as %s", (value, expected) => {
    expect(load({ SUPABASE_SMTP_CONFIGURED: value }).SUPABASE_SMTP_CONFIGURED).toBe(expected);
    expect(load({ OFAC_ENABLED: value }).OFAC_ENABLED).toBe(expected);
  });

  it("defaults both flags to false when unset", () => {
    const config = load({});
    expect(config.SUPABASE_SMTP_CONFIGURED).toBe(false);
    expect(config.OFAC_ENABLED).toBe(false);
  });

  it("rejects values that are not a recognized boolean", () => {
    expect(() => load({ SUPABASE_SMTP_CONFIGURED: "yes" })).toThrow(/SUPABASE_SMTP_CONFIGURED/);
  });
});
