import { describe, it, expect } from "vitest";
import { checkWebhookUrl, isNonPublicIp } from "../webhook-url.js";

describe("isNonPublicIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "[::1]",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "2002:c0a8:0101::1",
    "2001:db8::1",
    "fe80::1%eth0",
  ])("blocks %s", (ip) => {
    expect(isNonPublicIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "2002:0808:0808::1"])(
    "allows public %s",
    (ip) => {
      expect(isNonPublicIp(ip)).toBe(false);
    },
  );

  it("treats a malformed IPv6 literal as non-public", () => {
    expect(isNonPublicIp("1::2::3")).toBe(true);
  });
});

describe("checkWebhookUrl", () => {
  it("accepts a public https URL", () => {
    expect(checkWebhookUrl("https://api.example.com/hooks/pincerpay")).toBeNull();
    expect(checkWebhookUrl("https://8.8.8.8:8443/hook")).toBeNull();
  });

  it.each([
    ["http://api.example.com/hook", /https/],
    ["ftp://api.example.com/hook", /https/],
    ["not a url", /valid URL/],
    ["https://user:pass@api.example.com/hook", /credentials/],
    ["https://localhost/hook", /public hostname/],
    ["https://app.localhost/hook", /public hostname/],
    ["https://kora.railway.internal/hook", /public hostname/],
    ["https://metadata.google.internal/hook", /public hostname/],
    ["https://printer.local/hook", /public hostname/],
    ["https://kora/hook", /public hostname/],
    ["https://localhost./hook", /public hostname/],
    ["https://127.0.0.1/hook", /private or internal/],
    ["https://169.254.169.254/latest/meta-data", /private or internal/],
    ["https://2130706433/hook", /private or internal/],
    ["https://0x7f.0.0.1/hook", /private or internal/],
    ["https://[::1]/hook", /private or internal/],
    ["https://[::ffff:10.0.0.1]/hook", /private or internal/],
  ])("rejects %s", (url, reason) => {
    expect(checkWebhookUrl(url)).toMatch(reason);
  });

  it("allows http and private hosts only when allowPrivate is set", () => {
    expect(checkWebhookUrl("http://localhost:3000/hook", { allowPrivate: true })).toBeNull();
    expect(checkWebhookUrl("http://localhost:3000/hook")).not.toBeNull();
    expect(checkWebhookUrl("ftp://localhost/hook", { allowPrivate: true })).toMatch(/https/);
  });
});
