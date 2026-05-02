import { resolveChain } from "./chains/index.js";
import type { ChainNamespace, PincerPayConfig } from "./types/index.js";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * Returns true if the input is a valid Solana base58-encoded address (32–44 chars).
 * Does not perform on-curve / PDA / mint checks — format-only.
 */
export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS_PATTERN.test(address);
}

/**
 * Returns true if the input is a valid EVM-style address (`0x` + 40 hex chars).
 * Case-insensitive — does not enforce or verify EIP-55 checksum.
 */
export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_PATTERN.test(address);
}

/**
 * Resolve a chain shorthand (or CAIP-2 ID) to its namespace ("solana" or "eip155").
 * Throws if the chain is unknown.
 */
export function getChainNamespace(chainShorthand: string): ChainNamespace {
  const chain = resolveChain(chainShorthand);
  if (!chain) {
    throw new Error(
      `Unknown chain "${chainShorthand}" — cannot determine namespace.`,
    );
  }
  return chain.namespace;
}

/**
 * Validates that an address has the right format for a chain. Returns null on
 * success, or a human-readable error message naming the chain and the failed
 * pattern. The error string is intended to be embedded in a thrown Error.
 */
export function validateMerchantAddressForChain(
  address: string,
  chainShorthand: string,
): string | null {
  const namespace = getChainNamespace(chainShorthand);
  if (namespace === "solana") {
    if (!isValidSolanaAddress(address)) {
      return `address ${JSON.stringify(address)} is not a valid Solana address (expected base58, 32–44 chars matching ${SOLANA_ADDRESS_PATTERN}).`;
    }
  } else if (namespace === "eip155") {
    if (!isValidEvmAddress(address)) {
      return `address ${JSON.stringify(address)} is not a valid EVM address (expected ${EVM_ADDRESS_PATTERN}).`;
    }
  }
  return null;
}

/**
 * Resolve the receiving wallet address for a given chain from a PincerPayConfig.
 *
 * Resolution order:
 * 1. `config.merchantAddresses[chainShorthand]` (case-insensitive key match)
 * 2. `config.merchantAddress` (legacy single-string fallback)
 * 3. `undefined` — caller must handle / throw
 *
 * Useful for testing ("which address would PincerPay actually use for chain X?")
 * and for the middleware's per-route payTo resolution.
 */
export function resolveMerchantAddress(
  config: Pick<PincerPayConfig, "merchantAddress" | "merchantAddresses">,
  chainShorthand: string,
): string | undefined {
  const map = config.merchantAddresses;
  if (map) {
    const key = chainShorthand.toLowerCase();
    for (const [candidateKey, candidateValue] of Object.entries(map)) {
      if (candidateKey.toLowerCase() === key && candidateValue) {
        return candidateValue;
      }
    }
  }
  return config.merchantAddress;
}
