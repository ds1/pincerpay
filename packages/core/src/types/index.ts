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

/** Settlement type: x402 (off-chain via x402 protocol) or direct (on-chain via Anchor program) */
export type SettlementType = "x402" | "direct";

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
  /** Settlement path used: x402 (off-chain) or direct (on-chain Anchor program) */
  settlementType?: SettlementType;
  /** On-chain settlement nonce (links to SettlementRecord PDA) */
  programNonce?: string;
  /** Solana slot number (null for EVM) */
  slot?: string;
  /** Solana priority fee in microlamports (null for EVM) */
  priorityFee?: string;
  /** Solana compute units consumed (null for EVM) */
  computeUnits?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

// ─── On-Chain Settlement Types ───

/** On-chain settlement record from the Anchor program */
export interface OnChainSettlement {
  nonce: string;
  agent: string;
  merchant: string;
  merchantAccount: string;
  amount: string;
  slot: string;
  /** 0 = direct on-chain, 1 = x402 recorded */
  txType: number;
  x402TxHash: string;
  timestamp: number;
}

// ─── Agent Types ───

export type AgentStatus = "active" | "paused" | "revoked";

export interface AgentProfile {
  id: string;
  merchantId: string;
  name: string;
  solanaAddress: string;
  smartAccountPda?: string;
  settingsPda?: string;
  spendingLimitPda?: string;
  maxPerTransaction?: string;
  maxPerDay?: string;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SolanaSmartAgentConfig extends AgentConfig {
  /** Squads Settings PDA */
  settingsPda?: string;
  /** Smart Account index for PDA derivation */
  smartAccountIndex?: number;
  /** Spending Limit index for PDA derivation */
  spendingLimitIndex?: number;
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
  /**
   * Single receiving wallet address — used when the merchant accepts payments
   * on one chain only, or as a fallback for chains not listed in
   * `merchantAddresses`. Either `merchantAddress` or `merchantAddresses`
   * must be set.
   */
  merchantAddress?: string;
  /**
   * Per-chain receiving wallets keyed by chain shorthand (e.g.,
   * `{ solana: "...", polygon: "0x..." }`). Use the same shorthands as
   * `RoutePaywallConfig.chain` and `resolveChain()` — `"solana"`,
   * `"polygon"`, `"base"`, `"solana-devnet"`, etc. Keys are matched
   * case-insensitively. Wins over `merchantAddress` for any chain present
   * in the map.
   *
   * Agents pay on whichever chain they hold USDC; PincerPay routes
   * settlement to your registered wallet on that chain. No cross-chain
   * conversion happens.
   */
  merchantAddresses?: Record<string, string>;
  /** Facilitator URL (defaults to PincerPay hosted) */
  facilitatorUrl?: string;
  /** Route-level paywall configs */
  routes: Record<string, RoutePaywallConfig>;
  /** Defer facilitator sync to first request instead of middleware init (default: false) */
  syncFacilitatorOnStart?: boolean;
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

// ─── Merchant Middleware Context ───

/**
 * Verified payment information surfaced on the request context after the
 * PincerPay middleware successfully settles a payment. The `payer` field
 * comes from the facilitator's settle response (not the unverified
 * X-PAYMENT request header), so it is canonical and chain-agnostic.
 */
export interface PincerPayPaymentInfo {
  /** Verified payer wallet address (Solana base58 or EVM 0x-hex) */
  payer: string;
  /** Settlement transaction hash on the chain that processed the payment */
  transaction: string;
  /** CAIP-2 network identifier (e.g., "solana:devnet", "eip155:8453") */
  network: string;
}

/**
 * Hono `Variables` shape contributed by `createPincerPayMiddleware`.
 *
 * ```ts
 * import { Hono } from "hono";
 * import type { PincerPayContextVariables } from "@pincerpay/merchant/nextjs";
 *
 * const app = new Hono<{ Variables: PincerPayContextVariables }>();
 *
 * app.get("/api/weather", (c) => {
 *   const { payer } = c.get("pincerpay");
 *   return c.json({ temp: 72, paidBy: payer });
 * });
 * ```
 */
export type PincerPayContextVariables = {
  pincerpay: PincerPayPaymentInfo;
};

// ─── Zod Schemas ───

export const RoutePaywallConfigSchema = z.object({
  price: z.string().regex(/^\d+\.?\d*$/, "Must be a valid USDC amount"),
  chain: z.string().optional(),
  chains: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const PincerPayConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    merchantAddress: z.string().min(1).optional(),
    merchantAddresses: z.record(z.string(), z.string().min(1)).optional(),
    facilitatorUrl: z.string().url().optional(),
    routes: z.record(z.string(), RoutePaywallConfigSchema),
    syncFacilitatorOnStart: z.boolean().optional(),
  })
  .refine(
    (cfg) =>
      Boolean(cfg.merchantAddress) ||
      (cfg.merchantAddresses &&
        Object.values(cfg.merchantAddresses).some((v) => Boolean(v))),
    {
      message:
        "Set either `merchantAddress` (legacy single-chain) or `merchantAddresses` (per-chain map). At least one entry is required.",
      path: ["merchantAddresses"],
    },
  );

export const SpendingPolicySchema = z.object({
  maxPerTransaction: z.string().optional(),
  maxPerDay: z.string().optional(),
  allowedMerchants: z.array(z.string()).optional(),
  allowedChains: z.array(z.string()).optional(),
});
