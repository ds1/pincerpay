import type { ChainConfig } from "../types/index.js";

// ─── Mainnet Chains ───

export const BASE_MAINNET: ChainConfig = {
  caip2Id: "eip155:8453",
  shorthand: "base",
  name: "Base",
  namespace: "eip155",
  chainId: 8453,
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdcDecimals: 6,
  rpcUrl: "https://mainnet.base.org",
  wsRpcUrl: "wss://base-mainnet.g.alchemy.com/v2",
  testnet: false,
  explorerUrl: "https://basescan.org",
  blockTimeMs: 2000,
};

export const POLYGON_MAINNET: ChainConfig = {
  caip2Id: "eip155:137",
  shorthand: "polygon",
  name: "Polygon",
  namespace: "eip155",
  chainId: 137,
  usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  usdcDecimals: 6,
  rpcUrl: "https://polygon-rpc.com",
  wsRpcUrl: "wss://polygon-mainnet.g.alchemy.com/v2",
  testnet: false,
  explorerUrl: "https://polygonscan.com",
  blockTimeMs: 2000,
};

export const SOLANA_MAINNET: ChainConfig = {
  caip2Id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  shorthand: "solana",
  name: "Solana",
  namespace: "solana",
  usdcAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdcDecimals: 6,
  rpcUrl: "https://api.mainnet-beta.solana.com",
  wsRpcUrl: "wss://api.mainnet-beta.solana.com",
  testnet: false,
  explorerUrl: "https://explorer.solana.com",
  blockTimeMs: 400,
};

// ─── Testnet Chains ───

export const BASE_SEPOLIA: ChainConfig = {
  caip2Id: "eip155:84532",
  shorthand: "base-sepolia",
  name: "Base Sepolia",
  namespace: "eip155",
  chainId: 84532,
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  usdcDecimals: 6,
  rpcUrl: "https://sepolia.base.org",
  testnet: true,
  explorerUrl: "https://sepolia.basescan.org",
  blockTimeMs: 2000,
};

export const POLYGON_AMOY: ChainConfig = {
  caip2Id: "eip155:80002",
  shorthand: "polygon-amoy",
  name: "Polygon Amoy",
  namespace: "eip155",
  chainId: 80002,
  usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  usdcDecimals: 6,
  rpcUrl: "https://rpc-amoy.polygon.technology",
  testnet: true,
  explorerUrl: "https://amoy.polygonscan.com",
  blockTimeMs: 2000,
};

export const SOLANA_DEVNET: ChainConfig = {
  caip2Id: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  shorthand: "solana-devnet",
  name: "Solana Devnet",
  namespace: "solana",
  usdcAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  usdcDecimals: 6,
  rpcUrl: "https://api.devnet.solana.com",
  testnet: true,
  explorerUrl: "https://explorer.solana.com?cluster=devnet",
  blockTimeMs: 400,
};

// ─── Chain Registry ───

export const CHAINS: Record<string, ChainConfig> = {
  // Mainnets
  base: BASE_MAINNET,
  polygon: POLYGON_MAINNET,
  solana: SOLANA_MAINNET,
  // Testnets
  "base-sepolia": BASE_SEPOLIA,
  "polygon-amoy": POLYGON_AMOY,
  "solana-devnet": SOLANA_DEVNET,
};

/** Reverse lookup: CAIP-2 ID → ChainConfig */
export const CHAINS_BY_CAIP2: Record<string, ChainConfig> = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.caip2Id, c]),
);

/**
 * Resolve a chain shorthand (e.g., "base") or CAIP-2 ID (e.g., "eip155:8453")
 * to a ChainConfig. Returns undefined if not found.
 */
export function resolveChain(input: string): ChainConfig | undefined {
  return CHAINS[input] ?? CHAINS_BY_CAIP2[input];
}

/**
 * Resolve a chain shorthand to its CAIP-2 ID.
 * Throws if the chain is not recognized.
 */
export function toCAIP2(shorthand: string): string {
  const chain = resolveChain(shorthand);
  if (!chain) {
    throw new Error(`Unknown chain: "${shorthand}". Valid chains: ${Object.keys(CHAINS).join(", ")}`);
  }
  return chain.caip2Id;
}

/** Get all supported mainnet chain configs */
export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAINS).filter((c) => !c.testnet);
}

/** Get all supported testnet chain configs */
export function getTestnetChains(): ChainConfig[] {
  return Object.values(CHAINS).filter((c) => c.testnet);
}
