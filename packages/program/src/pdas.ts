import { type Address, getProgramDerivedAddress, getAddressEncoder } from "@solana/kit";

const encoder = getAddressEncoder();

/** Deployed Anchor program address (devnet). Override via ANCHOR_PROGRAM_ID env var for mainnet. */
export const PINCERPAY_PROGRAM_ID = (
  globalThis.process?.env?.ANCHOR_PROGRAM_ID ?? "E53zfNo9DYxAUCu37bA2NakJMMbzPFszjgB5kPaTMvF3"
) as Address;

const CONFIG_SEED = new TextEncoder().encode("config");
const MERCHANT_SEED = new TextEncoder().encode("merchant");
const SETTLEMENT_SEED = new TextEncoder().encode("settlement");

/** Derive ProgramConfig PDA: seeds = ["config"] */
export async function deriveConfigPda(
  programId: Address = PINCERPAY_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [CONFIG_SEED],
  });
}

/** Derive MerchantAccount PDA: seeds = ["merchant", merchant_id_bytes] */
export async function deriveMerchantPda(
  merchantId: string,
  programId: Address = PINCERPAY_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  const idBytes = uuidToBytes(merchantId);
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [MERCHANT_SEED, idBytes],
  });
}

/** Derive SettlementRecord PDA: seeds = ["settlement", nonce_le_bytes] */
export async function deriveSettlementPda(
  nonce: bigint,
  programId: Address = PINCERPAY_PROGRAM_ID,
): Promise<readonly [Address, number]> {
  const nonceBytes = new Uint8Array(8);
  const view = new DataView(nonceBytes.buffer);
  view.setBigUint64(0, nonce, true); // little-endian
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SETTLEMENT_SEED, nonceBytes],
  });
}

/** Convert UUID string to 16-byte Uint8Array */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert string to 32-byte zero-padded Uint8Array */
export function stringTo32Bytes(str: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(str.substring(0, 32));
  bytes.set(encoded);
  return bytes;
}

/** Convert x402 tx hash string to 64-byte Uint8Array (UTF-8 encoded, zero-padded) */
export function txHashToBytes(hash: string): Uint8Array {
  const bytes = new Uint8Array(64);
  const encoded = new TextEncoder().encode(hash.substring(0, 64));
  bytes.set(encoded);
  return bytes;
}
