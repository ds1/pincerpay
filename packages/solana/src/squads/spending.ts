import type { Address } from "@solana/kit";
import { createSolanaRpc } from "@solana/kit";
import type { SpendingLimitConfig } from "./types.js";
import { SpendingLimitPeriod } from "./types.js";
import { deriveSpendingLimitPda } from "./accounts.js";
import { addSpendingLimitInstruction, removeSpendingLimitInstruction } from "./instructions.js";

/**
 * Create a spending limit instruction for a Smart Account.
 * Returns the instruction — caller is responsible for signing and sending.
 */
export async function createSpendingLimit(
  config: SpendingLimitConfig,
  spendingLimitIndex: number,
  authority: Address,
) {
  return addSpendingLimitInstruction(config, spendingLimitIndex, authority);
}

/**
 * Check if a spending limit account exists on-chain and fetch its state.
 * Returns null if the account doesn't exist.
 */
export async function checkSpendingLimit(
  smartAccountPda: Address,
  spendingLimitIndex: number,
  rpcUrl: string,
): Promise<{
  exists: boolean;
  remainingAmount?: bigint;
  period?: SpendingLimitPeriod;
  lastReset?: bigint;
} | null> {
  const rpc = createSolanaRpc(rpcUrl);
  const [spendingLimitPda] = await deriveSpendingLimitPda(smartAccountPda, spendingLimitIndex);

  const accountInfo = await rpc
    .getAccountInfo(spendingLimitPda, { encoding: "base64" })
    .send();

  if (!accountInfo.value) {
    return null;
  }

  // Parse the account data
  // Layout: discriminator(8) + smart_account(32) + mint(32) + amount(8) + remaining_amount(8) + period(1) + last_reset(8) + ...
  const data = Buffer.from(accountInfo.value.data[0] as string, "base64");
  if (data.length < 89) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const remainingAmount = view.getBigUint64(80, true); // offset 8+32+32+8 = 80
  const period = data[88] as SpendingLimitPeriod; // offset 80+8 = 88
  const lastReset = view.getBigUint64(89, true); // offset 88+1 = 89

  return {
    exists: true,
    remainingAmount,
    period,
    lastReset,
  };
}

/**
 * Revoke a spending limit from a Smart Account.
 * Returns the instruction — caller is responsible for signing and sending.
 */
export async function revokeSpendingLimit(
  smartAccountPda: Address,
  spendingLimitIndex: number,
  authority: Address,
  rentCollector: Address,
) {
  return removeSpendingLimitInstruction({
    smartAccountPda,
    spendingLimitIndex,
    authority,
    rentCollector,
  });
}
