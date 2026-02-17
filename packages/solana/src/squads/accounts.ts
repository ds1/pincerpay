import type { Address } from "@solana/kit";
import { getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import { SQUADS_PROGRAM_ID } from "./types.js";

export { SQUADS_PROGRAM_ID };

/**
 * Derive the Smart Account PDA.
 * Seeds: ["smart_account", creator, account_index (u32 LE)]
 */
export async function deriveSmartAccountPda(
  creator: Address,
  accountIndex: number,
  programId: Address = SQUADS_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  const encoder = getAddressEncoder();
  const indexBuffer = new Uint8Array(4);
  new DataView(indexBuffer.buffer).setUint32(0, accountIndex, true); // little-endian

  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      new TextEncoder().encode("smart_account"),
      encoder.encode(creator),
      indexBuffer,
    ],
  });
}

/**
 * Derive the Settings PDA for a Smart Account.
 * Seeds: ["settings", smart_account_pda]
 */
export async function deriveSettingsPda(
  smartAccountPda: Address,
  programId: Address = SQUADS_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  const encoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      new TextEncoder().encode("settings"),
      encoder.encode(smartAccountPda),
    ],
  });
}

/**
 * Derive a Spending Limit PDA.
 * Seeds: ["spending_limit", smart_account_pda, spending_limit_index (u32 LE)]
 */
export async function deriveSpendingLimitPda(
  smartAccountPda: Address,
  spendingLimitIndex: number,
  programId: Address = SQUADS_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  const encoder = getAddressEncoder();
  const indexBuffer = new Uint8Array(4);
  new DataView(indexBuffer.buffer).setUint32(0, spendingLimitIndex, true);

  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      new TextEncoder().encode("spending_limit"),
      encoder.encode(smartAccountPda),
      indexBuffer,
    ],
  });
}
