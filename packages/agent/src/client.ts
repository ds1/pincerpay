import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import type { AgentConfig, SpendingPolicy } from "@pincerpay/core";

/**
 * PincerPayAgent — wraps x402/fetch with EVM + Solana wallet support and spending policies.
 *
 * ```ts
 * const agent = await PincerPayAgent.create({
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
  private _solanaAddress?: string;

  /**
   * Create a new PincerPayAgent. Use `PincerPayAgent.create()` for async initialization
   * (required when using Solana wallets).
   */
  constructor(config: AgentConfig, client?: x402Client) {
    this.config = config;

    if (!config.evmPrivateKey && !config.solanaPrivateKey) {
      throw new Error("At least one wallet key (evmPrivateKey or solanaPrivateKey) is required");
    }

    const x402 = client ?? new x402Client();

    // Register EVM scheme synchronously
    if (config.evmPrivateKey && !client) {
      const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
      registerExactEvmScheme(x402, { signer: account });
    }

    // Register spending policy hooks
    this.registerPolicyHooks(x402);

    // Wrap global fetch with x402 payment handling
    this.x402Fetch = wrapFetchWithPayment(globalThis.fetch, x402);
  }

  /**
   * Async factory — use this when Solana wallets are needed.
   * Also works for EVM-only agents.
   */
  static async create(config: AgentConfig): Promise<PincerPayAgent> {
    const client = new x402Client();

    // Register EVM scheme
    if (config.evmPrivateKey) {
      const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
      registerExactEvmScheme(client, { signer: account });
    }

    // Register Solana scheme (async — needs key derivation)
    let solanaAddress: string | undefined;
    if (config.solanaPrivateKey) {
      const keyBytes = base58Decode(config.solanaPrivateKey);
      const keypairSigner = await createKeyPairSignerFromBytes(keyBytes);
      registerExactSvmScheme(client, { signer: keypairSigner });
      solanaAddress = keypairSigner.address;
    }

    const agent = new PincerPayAgent(config, client);
    agent._solanaAddress = solanaAddress;
    return agent;
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

  /** Get the agent's Solana address (only available via PincerPayAgent.create()) */
  get solanaAddress(): string | undefined {
    return this._solanaAddress;
  }

  /** Get configured chain shorthands */
  get chains(): string[] {
    return this.config.chains;
  }

  /**
   * Register x402 hooks to enforce spending policies before payment
   * and record spend after successful payment creation.
   */
  private registerPolicyHooks(client: x402Client): void {
    if (!this.config.policies || this.config.policies.length === 0) return;

    // Before payment: enforce spending limits
    client.onBeforePaymentCreation(async (ctx: { selectedRequirements: { maxAmountRequired?: unknown; amount?: unknown } }) => {
      const amount = String(ctx.selectedRequirements.maxAmountRequired ?? ctx.selectedRequirements.amount ?? "0");
      const check = this.checkPolicy(amount);
      if (!check.allowed) {
        return { abort: true, reason: check.reason! };
      }
    });

    // After payment: track spend for daily limits
    client.onAfterPaymentCreation(async (ctx: { selectedRequirements: { maxAmountRequired?: unknown; amount?: unknown } }) => {
      const amount = String(ctx.selectedRequirements.maxAmountRequired ?? ctx.selectedRequirements.amount ?? "0");
      this.recordSpend(amount);
    });
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

/**
 * Minimal base58 decoder for Solana private keys.
 * Avoids pulling in @scure/base as a dependency for the agent SDK.
 */
function base58Decode(input: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const BASE = BigInt(58);
  let num = 0n;
  for (const char of input) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * BASE + BigInt(idx);
  }

  // Count leading zeros
  let leadingZeros = 0;
  for (const char of input) {
    if (char !== "1") break;
    leadingZeros++;
  }

  // Convert to bytes
  const hex = num.toString(16).padStart(2, "0");
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}
