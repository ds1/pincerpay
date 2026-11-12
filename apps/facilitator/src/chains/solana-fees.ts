import {
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";

const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const SET_COMPUTE_UNIT_LIMIT = 2;
const SET_COMPUTE_UNIT_PRICE = 3;

/** Solana's per-transaction compute ceiling; assumed when no limit is set. */
export const MAX_TRANSACTION_COMPUTE_UNITS = 1_400_000;

/**
 * Caps on what the facilitator, as fee payer, will pay for one agent-built
 * transaction. The stock x402 client requests 20,000 CU at 1 microlamport/CU
 * with two signers (agent + fee payer), far below these defaults.
 */
export interface SolanaFeeLimits {
  maxComputeUnitLimit: number;
  maxPriorityFeeLamports: number;
  maxSignatures: number;
}

export const DEFAULT_SOLANA_FEE_LIMITS: SolanaFeeLimits = {
  maxComputeUnitLimit: 200_000,
  maxPriorityFeeLamports: 5_000,
  maxSignatures: 3,
};

export interface SolanaFeeParams {
  computeUnitLimit: number;
  computeUnitPriceMicroLamports: bigint;
  /** ceil(limit × price / 1e6) — what the fee payer pays on top of the base fee. */
  priorityFeeLamports: bigint;
  signatures: number;
}

/**
 * Read the fee-relevant fields from a base64 wire transaction. Throws on
 * bytes that don't decode as a Solana transaction.
 */
export function readSolanaFeeParams(base64Transaction: string): SolanaFeeParams {
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(base64Transaction));
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

  let computeUnitLimit: number | undefined;
  let computeUnitPriceMicroLamports = 0n;

  for (const ix of message.instructions) {
    if (message.staticAccounts[ix.programAddressIndex] !== COMPUTE_BUDGET_PROGRAM) continue;
    const data = ix.data;
    if (!data || data.length === 0) continue;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data[0] === SET_COMPUTE_UNIT_LIMIT && data.length >= 5) {
      computeUnitLimit = view.getUint32(1, true);
    } else if (data[0] === SET_COMPUTE_UNIT_PRICE && data.length >= 9) {
      computeUnitPriceMicroLamports = view.getBigUint64(1, true);
    }
  }

  const limit = computeUnitLimit ?? MAX_TRANSACTION_COMPUTE_UNITS;
  const microLamports = BigInt(limit) * computeUnitPriceMicroLamports;
  const priorityFeeLamports = (microLamports + 999_999n) / 1_000_000n;

  return {
    computeUnitLimit: limit,
    computeUnitPriceMicroLamports,
    priorityFeeLamports,
    signatures: message.header.numSignerAccounts,
  };
}

/** Returns a reason string when the transaction exceeds a limit, else null. */
export function checkSolanaFeeLimits(
  params: SolanaFeeParams,
  limits: SolanaFeeLimits,
): string | null {
  if (params.computeUnitLimit > limits.maxComputeUnitLimit) {
    return `compute unit limit ${params.computeUnitLimit} exceeds ${limits.maxComputeUnitLimit}`;
  }
  if (params.priorityFeeLamports > BigInt(limits.maxPriorityFeeLamports)) {
    return `priority fee ${params.priorityFeeLamports} lamports exceeds ${limits.maxPriorityFeeLamports}`;
  }
  if (params.signatures > limits.maxSignatures) {
    return `${params.signatures} signatures exceeds ${limits.maxSignatures}`;
  }
  return null;
}
