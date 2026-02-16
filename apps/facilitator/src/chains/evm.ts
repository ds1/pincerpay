import { type Chain, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, polygon, polygonAmoy } from "viem/chains";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import type { Network } from "@x402/core/types";
import type { Logger } from "../middleware/logging.js";

/** Map CAIP-2 network IDs to viem chain definitions */
const CHAIN_MAP: Record<string, Chain> = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
  "eip155:137": polygon,
  "eip155:80002": polygonAmoy,
};

interface EvmSetupOptions {
  privateKey: `0x${string}`;
  networks: string[];
  rpcUrls: Record<string, string>;
  logger: Logger;
}

/**
 * Create a viem signer for the facilitator and register EVM scheme handlers.
 * Returns the configured x402Facilitator instance.
 */
export function setupEvmFacilitator(
  facilitator: x402Facilitator,
  options: EvmSetupOptions,
): x402Facilitator {
  const { privateKey, networks, rpcUrls, logger } = options;
  const account = privateKeyToAccount(privateKey);

  logger.info({
    msg: "evm_facilitator_setup",
    address: account.address,
    networks,
  });

  for (const network of networks) {
    const chain = CHAIN_MAP[network];
    if (!chain) {
      logger.warn({ msg: "unknown_evm_network", network });
      continue;
    }

    const transport = http(rpcUrls[network] ?? undefined);

    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    });

    const publicClient = createPublicClient({
      chain,
      transport,
    });

    // Merge public + wallet client methods for the signer interface
    const combinedClient = {
      ...publicClient,
      ...walletClient,
      address: account.address,
      getAddresses: () => [account.address] as const,
      getCode: publicClient.getCode.bind(publicClient),
    };

    const signer = toFacilitatorEvmSigner(combinedClient as Parameters<typeof toFacilitatorEvmSigner>[0]);

    registerExactEvmScheme(facilitator, {
      signer,
      networks: network as Network,
    });

    logger.info({
      msg: "evm_network_registered",
      network,
      chain: chain.name,
      facilitatorAddress: account.address,
    });
  }

  return facilitator;
}
