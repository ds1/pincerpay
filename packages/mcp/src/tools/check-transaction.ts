import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  txHash: z
    .string()
    .min(1)
    .describe(
      "Transaction hash (EVM hex) or signature (Solana base58) to look up.",
    ),
};

export function registerCheckTransaction(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "check-transaction-status",
    "Query the PincerPay facilitator for the status of a payment transaction. " +
      "Returns chain, amount, addresses, status (pending/mempool/optimistic/confirmed/failed), " +
      "and timestamps. Requires a PincerPay API key.",
    inputSchema,
    async ({ txHash }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await client.getStatus(txHash);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to fetch transaction status: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
