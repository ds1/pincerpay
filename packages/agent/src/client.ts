import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { AgentConfig, SpendingPolicy } from "@pincerpay/core";

/**
 * PincerPayAgent — wraps x402/fetch with EVM wallet support and spending policies.
 *
 * ```ts
 * const agent = new PincerPayAgent({
 *   chains: ["base-sepolia"],
 *   evmPrivateKey: process.env.AGENT_EVM_KEY!,
 * });
 *
 * const response = await agent.fetch("https://api.example.com/weather");
 * ```
 */
export class PincerPayAgent {
  private config: AgentConfig;
  private x402Fetch: typeof globalThis.fetch;
  private dailySpend: Map<string, bigint> = new Map();
  private dailyResetAt: number = 0;

  constructor(config: AgentConfig) {
    this.config = config;

    if (!config.evmPrivateKey && !config.solanaPrivateKey) {
      throw new Error("At least one wallet key (evmPrivateKey or solanaPrivateKey) is required");
    }

    // Set up x402 client with EVM scheme
    const client = new x402Client();

    if (config.evmPrivateKey) {
      const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
      registerExactEvmScheme(client, { signer: account });
    }

    // Wrap global fetch with x402 payment handling
    this.x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);
  }

  /**
   * Payment-enabled fetch — automatically handles 402 challenges.
   */
  async fetch(
    url: string | URL,
    init?: RequestInit,
  ): Promise<Response> {
    return this.x402Fetch(url.toString(), init);
  }

  /**
   * Check if a transaction amount is within spending policy limits.
   */
  checkPolicy(amountBaseUnits: string): { allowed: boolean; reason?: string } {
    const policies = this.config.policies;
    if (!policies || policies.length === 0) {
      return { allowed: true };
    }

    const amount = BigInt(amountBaseUnits);

    for (const policy of policies) {
      // Per-transaction limit
      if (policy.maxPerTransaction) {
        const max = BigInt(policy.maxPerTransaction);
        if (amount > max) {
          return {
            allowed: false,
            reason: `Exceeds per-transaction limit: ${amountBaseUnits} > ${policy.maxPerTransaction}`,
          };
        }
      }

      // Daily limit
      if (policy.maxPerDay) {
        this.resetDailyIfNeeded();
        const todayKey = new Date().toISOString().slice(0, 10);
        const currentSpend = this.dailySpend.get(todayKey) ?? 0n;
        const max = BigInt(policy.maxPerDay);

        if (currentSpend + amount > max) {
          return {
            allowed: false,
            reason: `Exceeds daily limit: ${currentSpend + amount} > ${policy.maxPerDay}`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Record a successful spend for daily tracking.
   */
  recordSpend(amountBaseUnits: string): void {
    this.resetDailyIfNeeded();
    const todayKey = new Date().toISOString().slice(0, 10);
    const current = this.dailySpend.get(todayKey) ?? 0n;
    this.dailySpend.set(todayKey, current + BigInt(amountBaseUnits));
  }

  /** Get the agent's EVM address */
  get evmAddress(): string | undefined {
    if (!this.config.evmPrivateKey) return undefined;
    return privateKeyToAccount(this.config.evmPrivateKey as `0x${string}`).address;
  }

  /** Get configured chain shorthands */
  get chains(): string[] {
    return this.config.chains;
  }

  private resetDailyIfNeeded(): void {
    const now = Date.now();
    if (now > this.dailyResetAt) {
      this.dailySpend.clear();
      // Reset at midnight UTC
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      this.dailyResetAt = tomorrow.getTime();
    }
  }
}
