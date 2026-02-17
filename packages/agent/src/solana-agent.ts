import type { Address } from "@solana/kit";
import { createSolanaRpc } from "@solana/kit";
import type { SolanaSmartAgentConfig } from "@pincerpay/core";
import {
  deriveSmartAccountPda,
  deriveSettingsPda,
  deriveSpendingLimitPda,
  checkSpendingLimit,
} from "@pincerpay/solana/squads";
import { PincerPayAgent } from "./client.js";

/**
 * SolanaSmartAgent — extends PincerPayAgent with Squads Smart Account support.
 *
 * Spending limits are enforced on-chain via the Squads program, not in-memory.
 * This agent performs an optimistic pre-check against the on-chain spending limit
 * before each payment, but the real enforcement happens at the transaction level.
 *
 * ```ts
 * const agent = await SolanaSmartAgent.create({
 *   chains: ["solana"],
 *   solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
 *   smartAccountIndex: 0,
 *   spendingLimitIndex: 0,
 * });
 *
 * const response = await agent.fetch("https://api.example.com/weather");
 * ```
 */
export class SolanaSmartAgent extends PincerPayAgent {
  private smartConfig: SolanaSmartAgentConfig;
  private _smartAccountPda?: string;
  private _settingsPda?: string;
  private _spendingLimitPda?: string;

  private constructor(config: SolanaSmartAgentConfig) {
    super(config);
    this.smartConfig = config;
  }

  /**
   * Async factory — initializes the Solana wallet, derives Squads PDAs,
   * and optionally validates on-chain state.
   */
  static override async create(config: SolanaSmartAgentConfig): Promise<SolanaSmartAgent> {
    // Create the base agent (registers Solana x402 scheme)
    const baseAgent = await PincerPayAgent.create(config);

    // Create SolanaSmartAgent and transfer state
    const agent = new SolanaSmartAgent(config);
    // Copy over the Solana address from base agent
    Object.defineProperty(agent, "_solanaAddress", {
      value: baseAgent.solanaAddress,
      writable: true,
    });

    // Derive Squads PDAs if configured
    const solanaAddr = baseAgent.solanaAddress;
    if (solanaAddr && config.smartAccountIndex !== undefined) {
      const [smartPda] = await deriveSmartAccountPda(
        solanaAddr as Address,
        config.smartAccountIndex,
      );
      agent._smartAccountPda = smartPda;

      const [settingsPda] = await deriveSettingsPda(smartPda);
      agent._settingsPda = config.settingsPda ?? settingsPda;

      if (config.spendingLimitIndex !== undefined) {
        const [limitPda] = await deriveSpendingLimitPda(
          smartPda,
          config.spendingLimitIndex,
        );
        agent._spendingLimitPda = limitPda;
      }
    }

    return agent;
  }

  /** Get the Squads Smart Account PDA */
  get smartAccountPda(): string | undefined {
    return this._smartAccountPda;
  }

  /** Get the Squads Settings PDA */
  get settingsPda(): string | undefined {
    return this._settingsPda;
  }

  /** Get the Squads Spending Limit PDA */
  get spendingLimitPda(): string | undefined {
    return this._spendingLimitPda;
  }

  /**
   * Check on-chain spending limit before payment.
   * This is an optimistic pre-check — the real enforcement is on-chain.
   */
  async checkOnChainPolicy(
    amountBaseUnits: string,
    rpcUrl = "https://api.devnet.solana.com",
  ): Promise<{ allowed: boolean; reason?: string; remainingAmount?: bigint }> {
    if (!this._smartAccountPda || this.smartConfig.spendingLimitIndex === undefined) {
      // No Squads spending limit configured — fall back to in-memory policy
      return this.checkPolicy(amountBaseUnits);
    }

    const result = await checkSpendingLimit(
      this._smartAccountPda as Address,
      this.smartConfig.spendingLimitIndex,
      rpcUrl,
    );

    if (!result) {
      return {
        allowed: false,
        reason: "Spending limit account not found on-chain",
      };
    }

    const amount = BigInt(amountBaseUnits);
    if (result.remainingAmount !== undefined && amount > result.remainingAmount) {
      return {
        allowed: false,
        reason: `Exceeds on-chain spending limit: ${amountBaseUnits} > ${result.remainingAmount}`,
        remainingAmount: result.remainingAmount,
      };
    }

    return { allowed: true, remainingAmount: result.remainingAmount };
  }
}
