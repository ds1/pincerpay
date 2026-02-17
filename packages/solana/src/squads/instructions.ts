import type { Address, Instruction } from "@solana/kit";
import { getAddressEncoder } from "@solana/kit";
import { SQUADS_PROGRAM_ID, type SmartAccountConfig, type SpendingLimitConfig, SpendingLimitPeriod } from "./types.js";
import { deriveSmartAccountPda, deriveSettingsPda, deriveSpendingLimitPda } from "./accounts.js";

// Anchor discriminators are first 8 bytes of sha256("global:<instruction_name>")
// Pre-computed for the 4 instructions we need

/** sha256("global:create_smart_account")[0..8] */
const CREATE_SMART_ACCOUNT_DISC = new Uint8Array([
  0x18, 0x46, 0xf0, 0x52, 0x88, 0xa5, 0x03, 0x26,
]);

/** sha256("global:add_spending_limit_as_authority")[0..8] */
const ADD_SPENDING_LIMIT_DISC = new Uint8Array([
  0xd1, 0x81, 0xb2, 0x0f, 0x07, 0x0c, 0x79, 0xa2,
]);

/** sha256("global:use_spending_limit")[0..8] */
const USE_SPENDING_LIMIT_DISC = new Uint8Array([
  0x65, 0x7b, 0x5a, 0xf7, 0x80, 0x5e, 0x89, 0x11,
]);

/** sha256("global:remove_spending_limit_as_authority")[0..8] */
const REMOVE_SPENDING_LIMIT_DISC = new Uint8Array([
  0xc9, 0x18, 0x27, 0x0d, 0x3e, 0x5b, 0x7a, 0x4f,
]);

/** System Program ID */
const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;
/** SPL Token Program ID */
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;

/**
 * Build a `createSmartAccount` instruction.
 * Initializes a new Squads Smart Account with the given signers and threshold.
 */
export async function createSmartAccountInstruction(
  config: SmartAccountConfig,
): Promise<Instruction> {
  const [smartAccountPda] = await deriveSmartAccountPda(config.creator, config.accountIndex);
  const [settingsPda] = await deriveSettingsPda(smartAccountPda);

  // Serialize args: threshold (u16 LE) + members count (u32 LE) + members (32 bytes each)
  const argsSize = 8 + 2 + 4 + config.members.length * 32;
  const data = new Uint8Array(argsSize);
  const view = new DataView(data.buffer);
  let offset = 0;

  // Discriminator
  data.set(CREATE_SMART_ACCOUNT_DISC, offset);
  offset += 8;

  // Threshold (u16 LE)
  view.setUint16(offset, config.threshold, true);
  offset += 2;

  // Members array (Borsh: u32 length prefix + items)
  const encoder = getAddressEncoder();
  view.setUint32(offset, config.members.length, true);
  offset += 4;
  for (const member of config.members) {
    data.set(encoder.encode(member), offset);
    offset += 32;
  }

  return {
    programAddress: SQUADS_PROGRAM_ID,
    accounts: [
      { address: smartAccountPda, role: 1 }, // writable
      { address: settingsPda, role: 1 }, // writable
      { address: config.creator, role: 3 }, // writable + signer
      { address: SYSTEM_PROGRAM, role: 0 }, // readonly
    ],
    data,
  };
}

/**
 * Build an `addSpendingLimitAsAuthority` instruction.
 * Sets a per-mint spending cap with time period on a Smart Account.
 */
export async function addSpendingLimitInstruction(
  config: SpendingLimitConfig,
  spendingLimitIndex: number,
  authority: Address,
): Promise<Instruction> {
  const [settingsPda] = await deriveSettingsPda(config.smartAccountPda);
  const [spendingLimitPda] = await deriveSpendingLimitPda(config.smartAccountPda, spendingLimitIndex);

  // Serialize: disc + mint(32) + amount(u64 LE) + period(u8) + members_len(u32) + members + destinations_len(u32) + destinations
  const argsSize = 8 + 32 + 8 + 1 + 4 + config.members.length * 32 + 4 + config.destinations.length * 32;
  const data = new Uint8Array(argsSize);
  const view = new DataView(data.buffer);
  const encoder = getAddressEncoder();
  let offset = 0;

  data.set(ADD_SPENDING_LIMIT_DISC, offset);
  offset += 8;

  // Mint
  data.set(encoder.encode(config.mint), offset);
  offset += 32;

  // Amount (u64 LE)
  view.setBigUint64(offset, config.amount, true);
  offset += 8;

  // Period (u8 enum)
  data[offset] = config.period;
  offset += 1;

  // Members
  view.setUint32(offset, config.members.length, true);
  offset += 4;
  for (const member of config.members) {
    data.set(encoder.encode(member), offset);
    offset += 32;
  }

  // Destinations
  view.setUint32(offset, config.destinations.length, true);
  offset += 4;
  for (const dest of config.destinations) {
    data.set(encoder.encode(dest), offset);
    offset += 32;
  }

  return {
    programAddress: SQUADS_PROGRAM_ID,
    accounts: [
      { address: config.smartAccountPda, role: 0 }, // readonly
      { address: settingsPda, role: 0 }, // readonly
      { address: spendingLimitPda, role: 1 }, // writable
      { address: authority, role: 3 }, // writable + signer
      { address: SYSTEM_PROGRAM, role: 0 }, // readonly
    ],
    data,
  };
}

/**
 * Build a `useSpendingLimit` instruction.
 * Spends within the limit — no proposal required.
 */
export async function useSpendingLimitInstruction(params: {
  smartAccountPda: Address;
  spendingLimitIndex: number;
  /** Token mint (USDC) */
  mint: Address;
  /** Source token account (Smart Account's ATA) */
  sourceTokenAccount: Address;
  /** Destination token account */
  destinationTokenAccount: Address;
  /** Member (agent) signing the transaction */
  member: Address;
  /** Amount to spend (base units) */
  amount: bigint;
}): Promise<Instruction> {
  const [settingsPda] = await deriveSettingsPda(params.smartAccountPda);
  const [spendingLimitPda] = await deriveSpendingLimitPda(params.smartAccountPda, params.spendingLimitIndex);

  // Serialize: disc + amount(u64 LE)
  const data = new Uint8Array(8 + 8);
  const view = new DataView(data.buffer);
  data.set(USE_SPENDING_LIMIT_DISC, 0);
  view.setBigUint64(8, params.amount, true);

  return {
    programAddress: SQUADS_PROGRAM_ID,
    accounts: [
      { address: params.smartAccountPda, role: 0 }, // readonly
      { address: settingsPda, role: 0 }, // readonly
      { address: spendingLimitPda, role: 1 }, // writable
      { address: params.sourceTokenAccount, role: 1 }, // writable
      { address: params.destinationTokenAccount, role: 1 }, // writable
      { address: params.member, role: 2 }, // signer
      { address: params.mint, role: 0 }, // readonly
      { address: TOKEN_PROGRAM, role: 0 }, // readonly
    ],
    data,
  };
}

/**
 * Build a `removeSpendingLimitAsAuthority` instruction.
 * Revokes a spending limit from the Smart Account.
 */
export async function removeSpendingLimitInstruction(params: {
  smartAccountPda: Address;
  spendingLimitIndex: number;
  authority: Address;
  /** Account to receive the rent-exempt lamports */
  rentCollector: Address;
}): Promise<Instruction> {
  const [settingsPda] = await deriveSettingsPda(params.smartAccountPda);
  const [spendingLimitPda] = await deriveSpendingLimitPda(params.smartAccountPda, params.spendingLimitIndex);

  const data = new Uint8Array(8);
  data.set(REMOVE_SPENDING_LIMIT_DISC, 0);

  return {
    programAddress: SQUADS_PROGRAM_ID,
    accounts: [
      { address: params.smartAccountPda, role: 0 }, // readonly
      { address: settingsPda, role: 0 }, // readonly
      { address: spendingLimitPda, role: 1 }, // writable (closed)
      { address: params.authority, role: 3 }, // writable + signer
      { address: params.rentCollector, role: 1 }, // writable (receives lamports)
    ],
    data,
  };
}

// Re-export for convenience
export { SpendingLimitPeriod };
