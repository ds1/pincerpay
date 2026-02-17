import type { Address } from "@solana/kit";

/** Squads Smart Account program ID on mainnet/devnet */
export const SQUADS_PROGRAM_ID = "SMRTzfY6DfH5ik3TKiyLFfXexV8uSG3d2UksSCYdunG" as Address;

/** Configuration for creating a spending limit on a Smart Account */
export interface SpendingLimitConfig {
  /** The Smart Account PDA that owns this spending limit */
  smartAccountPda: Address;
  /** Token mint address (USDC) */
  mint: Address;
  /** Maximum amount allowed per time period (base units) */
  amount: bigint;
  /** Time period for the spending limit */
  period: SpendingLimitPeriod;
  /** Members (agent addresses) authorized to use this spending limit */
  members: Address[];
  /** Destination addresses the agent can send to */
  destinations: Address[];
}

/** Time period for spending limit reset */
export enum SpendingLimitPeriod {
  /** One-time allowance — no reset */
  OneTime = 0,
  /** Resets daily */
  Day = 1,
  /** Resets weekly */
  Week = 2,
  /** Resets monthly */
  Month = 3,
}

/** Configuration for creating a Smart Account */
export interface SmartAccountConfig {
  /** Creator/authority address */
  creator: Address;
  /** Index for PDA derivation (allows multiple accounts per creator) */
  accountIndex: number;
  /** Signers for the multisig */
  members: Address[];
  /** Number of required signers */
  threshold: number;
}
