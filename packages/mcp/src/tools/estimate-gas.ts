import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHAINS, resolveChain } from "@pincerpay/core";

const inputSchema = {
  chain: z.string().describe(
    "Chain shorthand (e.g., 'solana', 'base', 'polygon', 'solana-devnet'). " +
      `Valid values: ${Object.keys(CHAINS).join(", ")}`,
  ),
  amount: z
    .string()
    .optional()
    .describe(
      "USDC amount in human-readable format (e.g., '0.01'). " +
        "If provided, includes optimistic finality info.",
    ),
};

const GAS_ESTIMATES: Record<
  string,
  { token: string; estimateUsd: string; note: string }
> = {
  solana: {
    token: "SOL",
    estimateUsd: "~$0.00025",
    note: "Priority fee ~5000 microlamports. With Kora, gas is paid in USDC instead of SOL.",
  },
  "solana-devnet": {
    token: "SOL",
    estimateUsd: "~$0.00025",
    note: "Free devnet SOL from faucet.solana.com.",
  },
  base: {
    token: "ETH",
    estimateUsd: "~$0.001-0.01",
    note: "L2 gas typically <$0.01. EIP-1559 base + priority fee.",
  },
  "base-sepolia": {
    token: "ETH",
    estimateUsd: "~$0.001",
    note: "Free testnet ETH from Coinbase faucet.",
  },
  polygon: {
    token: "MATIC",
    estimateUsd: "~$0.001-0.005",
    note: "Low gas costs, EIP-1559.",
  },
  "polygon-amoy": {
    token: "MATIC",
    estimateUsd: "~$0.001",
    note: "Free testnet MATIC from faucet.",
  },
};

export function registerEstimateGas(server: McpServer) {
  server.tool(
    "estimate-gas-cost",
    "Estimate the gas/transaction fee for a USDC payment on a given chain. " +
      "Returns the native gas token, estimated USD cost, and notes about " +
      "Kora gasless transactions (Solana) or L2 gas optimization.",
    inputSchema,
    async ({ chain, amount }) => {
      const chainConfig = resolveChain(chain);
      if (!chainConfig) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown chain: "${chain}". Valid chains: ${Object.keys(CHAINS).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const estimate = GAS_ESTIMATES[chain] ?? {
        token: chainConfig.namespace === "solana" ? "SOL" : "ETH",
        estimateUsd: "unknown",
        note: "No gas estimate available for this chain.",
      };

      const parsedAmount = amount ? parseFloat(amount) : undefined;
      const isOptimistic =
        parsedAmount !== undefined ? parsedAmount < 1.0 : undefined;

      const result = {
        chain: chainConfig.shorthand,
        name: chainConfig.name,
        gasToken: estimate.token,
        estimatedGasCostUsd: estimate.estimateUsd,
        note: estimate.note,
        ...(isOptimistic !== undefined && {
          optimisticFinality: isOptimistic,
          optimisticNote: isOptimistic
            ? "Sub-$1 payments use optimistic finality (~200ms) — resource delivered before block confirmation."
            : "Payment will wait for full block confirmation before resource delivery.",
        }),
        blockTimeMs: chainConfig.blockTimeMs,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
