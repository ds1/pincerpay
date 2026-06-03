import { Hono } from "hono";
import type { x402Facilitator } from "@x402/core/facilitator";

/**
 * x402 v2 advertises networks by CAIP-2 id; the legacy v1 "exact" schemes
 * advertise by short name and dump their entire built-in registry (every
 * mainnet + testnet the scheme knows) regardless of what this facilitator is
 * configured and funded for. Left unfiltered, /v1/supported tells an agent we
 * settle on `ethereum`, `base`, `polygon`, `avalanche`, ... when this deploy is
 * testnet-only. We intersect the advertised kinds with the configured networks:
 * each configured CAIP-2 id matches the v2 kinds directly, and its v1 short-name
 * alias(es) below match the v1 kinds.
 *
 * Fail-safe by construction: a configured network with no alias entry simply has
 * its v1 kinds dropped (under-advertised), never the reverse — an unconfigured
 * mainnet can never leak back in.
 */
const CAIP2_TO_X402_V1_NAMES: Record<string, string[]> = {
  // Solana
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": ["solana-devnet"], // devnet (default config)
  // EVM (keyed by chain id; values are the @x402 v1 network names)
  "eip155:84532": ["base-sepolia"],
  "eip155:8453": ["base"],
  "eip155:80002": ["polygon-amoy"],
  "eip155:137": ["polygon"],
};

/**
 * Build the set of network identifiers this facilitator should advertise:
 * every configured CAIP-2 id plus its known x402-v1 short-name alias(es).
 * Pure + exported for unit tests.
 */
export function allowedSupportedNetworks(configuredNetworks: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const caip2 of configuredNetworks) {
    allowed.add(caip2);
    for (const v1Name of CAIP2_TO_X402_V1_NAMES[caip2] ?? []) {
      allowed.add(v1Name);
    }
  }
  return allowed;
}

export function createSupportedRoute(
  facilitator: x402Facilitator,
  options: { networks: string[] },
) {
  const app = new Hono();
  const allowed = allowedSupportedNetworks(options.networks);

  app.get("/v1/supported", (c) => {
    const supported = facilitator.getSupported();
    const filtered = {
      ...supported,
      kinds: supported.kinds.filter((k) => allowed.has(k.network)),
    };
    return c.json(filtered);
  });

  return app;
}
