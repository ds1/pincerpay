/**
 * Webhook destination policy. The facilitator POSTs to merchant-supplied
 * URLs, so they must not reach loopback, private, link-local or
 * platform-internal hosts (SSRF). Pure and dependency-free so the
 * facilitator, dashboard and SDKs can share one rule.
 */

export interface WebhookUrlOptions {
  /** Allow http and private/internal hosts. For local development only. */
  allowPrivate?: boolean;
}

const INTERNAL_SUFFIXES = [".localhost", ".internal", ".local", ".lan", ".home.arpa", ".intranet"];

/** IPv4 ranges that are not publicly routable: [network, prefix length]. */
const BLOCKED_IPV4: Array<[number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8 "this network"
  [0x0a000000, 8], // 10.0.0.0/8 private
  [0x64400000, 10], // 100.64.0.0/10 carrier-grade NAT
  [0x7f000000, 8], // 127.0.0.0/8 loopback
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local (cloud metadata)
  [0xac100000, 12], // 172.16.0.0/12 private
  [0xc0000000, 24], // 192.0.0.0/24 IETF protocol assignments
  [0xc0000200, 24], // 192.0.2.0/24 documentation
  [0xc0586300, 24], // 192.88.99.0/24 6to4 relay
  [0xc0a80000, 16], // 192.168.0.0/16 private
  [0xc6120000, 15], // 198.18.0.0/15 benchmarking
  [0xc6336400, 24], // 198.51.100.0/24 documentation
  [0xcb007100, 24], // 203.0.113.0/24 documentation
  [0xe0000000, 4], // 224.0.0.0/4 multicast
  [0xf0000000, 4], // 240.0.0.0/4 reserved + broadcast
];

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isBlockedIpv4(value: number): boolean {
  return BLOCKED_IPV4.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((value & mask) >>> 0) === network;
  });
}

/** Expand an IPv6 address to 8 16-bit groups, or null if malformed. */
function parseIpv6(ip: string): number[] | null {
  let text = ip;
  let embedded: number[] = [];

  // Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) becomes the last two groups.
  const lastColon = text.lastIndexOf(":");
  if (text.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(text.slice(lastColon + 1));
    if (v4 === null) return null;
    embedded = [Math.floor(v4 / 0x10000), v4 % 0x10000];
    text = text.slice(0, lastColon + 1);
    if (!text.endsWith("::")) text = text.slice(0, -1);
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const split = (s: string) => (s === "" ? [] : s.split(":"));
  const head = split(halves[0]);
  const rest = halves.length === 2 ? split(halves[1]) : [];
  if (![...head, ...rest].every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;

  const count = head.length + rest.length + embedded.length;
  if (halves.length === 1 ? count !== 8 : count > 7) return null;
  const zeros = halves.length === 2 ? new Array<string>(8 - count).fill("0") : [];
  return [...head, ...zeros, ...rest].map((g) => parseInt(g, 16)).concat(embedded);
}

function isBlockedIpv6(groups: number[]): boolean {
  const [g0, g1] = groups;

  // IPv4-mapped (::ffff:a.b.c.d): judge the IPv4 address.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return isBlockedIpv4(groups[6] * 0x10000 + groups[7]);
  }
  // Only global unicast (2000::/3) is routable. This also covers ::, ::1,
  // fc00::/7, fe80::/10, ff00::/8 and NAT64 (64:ff9b::/96).
  if (g0 < 0x2000 || g0 > 0x3fff) return true;
  if (g0 === 0x2001 && (g1 === 0x0db8 || g1 === 0x0000)) return true; // documentation, Teredo
  if (g0 === 0x2002) return isBlockedIpv4(g1 * 0x10000 + groups[2]); // 6to4 embeds IPv4
  return false;
}

/**
 * True when an IP address literal is loopback, private, link-local,
 * multicast, reserved or otherwise not publicly routable. Non-IP input
 * returns false.
 */
export function isNonPublicIp(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const v4 = parseIpv4(bare);
  if (v4 !== null) return isBlockedIpv4(v4);
  if (bare.includes(":")) {
    const v6 = parseIpv6(bare.split("%")[0]);
    return v6 === null ? true : isBlockedIpv6(v6);
  }
  return false;
}

/**
 * Validate a merchant webhook URL. Returns null when acceptable, or a
 * human-readable reason. Hostnames that resolve to private addresses must
 * additionally be blocked at connection time; see the facilitator's
 * webhook dispatcher.
 */
export function checkWebhookUrl(url: string, options: WebhookUrlOptions = {}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "webhook URL is not a valid URL";
  }

  if (parsed.protocol !== "https:" && !(options.allowPrivate && parsed.protocol === "http:")) {
    return "webhook URL must use https";
  }
  if (options.allowPrivate) return null;

  if (parsed.username || parsed.password) {
    return "webhook URL must not contain credentials";
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (parseIpv4(host) !== null || host.startsWith("[")) {
    return isNonPublicIp(host) ? "webhook URL must not point at a private or internal address" : null;
  }
  if (!host.includes(".") || host === "localhost" || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    return "webhook URL must use a public hostname";
  }
  return null;
}
