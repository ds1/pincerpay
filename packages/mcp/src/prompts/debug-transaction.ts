import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDebugPrompt(server: McpServer) {
  server.prompt(
    "debug-transaction",
    "Investigate a PincerPay transaction's status and diagnose issues. " +
      "Fetches transaction details from the facilitator and provides analysis.",
    {
      txHash: z
        .string()
        .describe("Transaction hash (EVM) or Solana signature."),
    },
    ({ txHash }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Debug this PincerPay transaction: ${txHash}

Please:
1. Use check-transaction-status to fetch the transaction details
2. Analyze the status (pending/mempool/optimistic/confirmed/failed)
3. If failed, explain common failure reasons:
   - Insufficient USDC balance
   - Wrong chain/network
   - Expired transaction timeout
   - RPC connectivity issues
4. Provide the block explorer link for the transaction
5. Suggest next steps to resolve any issues`,
          },
        },
      ],
    }),
  );
}
