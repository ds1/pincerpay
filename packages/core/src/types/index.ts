import { z } from "zod";

// ─── Chain Types ───

export type ChainNamespace = "eip155" | "solana";

export interface ChainConfig {
  /** CAIP-2 chain ID (e.g., "eip155:8453" for Base) */
  caip2Id: string;
  /** Human-readable shorthand (e.g., "base", "solana") */
  shorthand: string;
  /** Display name */
  name: string;
  /** Chain namespace */
  namespace: ChainNamespace;
  /** Numeric chain ID (EVM only) */
  chainId?: number;
  /** USDC contract address on this chain */
  usdcAddress: string;
  /** USDC decimals (6 for all current deployments) */
  usdcDecimals: number;
  /** Default RPC URL (overridable) */
  rpcUrl: string;
  /** WebSocket RPC URL (optional, for mempool monitoring) */
  wsRpcUrl?: string;
  /** Whether this is a testnet */
  testnet: boolean;
  /** Block explorer URL */
  explorerUrl: string;
  /** Average block time in milliseconds */
  blockTimeMs: number;
}

// ─── Merchant Types ───

export interface MerchantProfile {
  id: string;
  name: string;
  walletAddress: string;
  supportedChains: string[];
  webhookUrl?: string;
  createdAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  merchantId: string;
  keyHash: string;
  prefix: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface PaywallConfig {
  id: string;
  merchantId: string;
  /** HTTP method + path pattern (e.g., "GET /api/weather") */
  endpointPattern: string;
  /** USDC amount as string (e.g., "0.01") */
  amount: string;
  /** Supported chains for this paywall (defaults to merchant's chains) */
  chains?: string[];
  /** Human-readable description */
  description: string;
  isActive: boolean;
}

// ─── Transaction Types ───

export type TransactionStatus =
  | "pending"
  | "mempool"
  | "optimistic"
  | "confirmed"
  | "failed";

/** Solana commitment levels for confirmation */
export type SolanaConfirmationLevel = "processed" | "confirmed" | "finalized";

export interface Transaction {
  id: string;
  merchantId: string;
  /** CAIP-2 chain ID */
  chainId: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  /** USDC amount in base units (e.g., "1000000" = 1 USDC) */
  amount: string;
  /** Gas/fee cost in base units of gasToken */
  gasCost: string;
  /** Token used for transaction fees (e.g., "ETH", "SOL", "MATIC", "USDC") */
  gasToken: string;
  status: TransactionStatus;
  /** Whether optimistic finality was used */
  optimistic: boolean;
  /** Solana slot number (null for EVM) */
  slot?: string;
  /** Solana priority fee in microlamports (null for EVM) */
  priorityFee?: string;
  /** Solana compute units consumed (null for EVM) */
  computeUnits?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

// ─── Spending Policy ───

export interface SpendingPolicy {
  /** Max USDC per transaction (base units) */
  maxPerTransaction?: string;
  /** Max USDC per day (base units) */
  maxPerDay?: string;
  /** Allowed merchant addresses */
  allowedMerchants?: string[];
  /** Allowed chains (shorthands) */
  allowedChains?: string[];
}

// ─── SDK Config Types ───

export interface PincerPayConfig {
  /** Merchant API key */
  apiKey: string;
  /** Merchant wallet address */
  merchantAddress: string;
  /** Facilitator URL (defaults to PincerPay hosted) */
  facilitatorUrl?: string;
  /** Route-level paywall configs */
  routes: Record<string, RoutePaywallConfig>;
}

export interface RoutePaywallConfig {
  /** USDC price as string (e.g., "0.01") */
  price: string;
  /** Preferred chain shorthand */
  chain?: string;
  /** Multiple chain shorthands */
  chains?: string[];
  /** Description shown in 402 response */
  description?: string;
}

export interface AgentConfig {
  /** Supported chain shorthands */
  chains: string[];
  /** EVM private key (hex) */
  evmPrivateKey?: string;
  /** Solana private key (base58) */
  solanaPrivateKey?: string;
  /** Spending policies */
  policies?: SpendingPolicy[];
  /** Custom facilitator URL */
  facilitatorUrl?: string;
}

// ─── Zod Schemas ───

export const RoutePaywallConfigSchema = z.object({
  price: z.string().regex(/^\d+\.?\d*$/, "Must be a valid USDC amount"),
  chain: z.string().optional(),
  chains: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const PincerPayConfigSchema = z.object({
  apiKey: z.string().min(1),
  merchantAddress: z.string().min(1),
  facilitatorUrl: z.string().url().optional(),
  routes: z.record(z.string(), RoutePaywallConfigSchema),
});

export const SpendingPolicySchema = z.object({
  maxPerTransaction: z.string().optional(),
  maxPerDay: z.string().optional(),
  allowedMerchants: z.array(z.string()).optional(),
  allowedChains: z.array(z.string()).optional(),
});
