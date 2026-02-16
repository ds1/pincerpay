import type { ChainNamespace } from "@pincerpay/core";

/** Determine chain namespace from CAIP-2 ID */
export function getNamespace(caip2: string): ChainNamespace {
  if (caip2.startsWith("eip155:")) return "eip155";
  if (caip2.startsWith("solana:")) return "solana";
  throw new Error(`Unknown chain namespace for: ${caip2}`);
}

/** Parse comma-separated network list */
export function parseNetworks(networksStr: string): string[] {
  return networksStr
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Group networks by namespace */
export function groupByNamespace(networks: string[]): Record<ChainNamespace, string[]> {
  const result: Record<ChainNamespace, string[]> = {
    eip155: [],
    solana: [],
  };

  for (const network of networks) {
    const ns = getNamespace(network);
    result[ns].push(network);
  }

  return result;
}
