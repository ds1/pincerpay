import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  limit: z.number().int().min(1).max(200).default(50).describe("Max items to return."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset."),
  status: z
    .string()
    .optional()
    .describe("Filter by status: pending, mempool, optimistic, confirmed, failed."),
  chain: z
    .string()
    .optional()
    .describe('Filter by CAIP-2 chain ID, e.g. "solana:devnet" or "eip155:8453".'),
  from: z
    .string()
    .optional()
    .describe("Filter by sender address."),
  to: z
    .string()
    .optional()
    .describe("Filter by recipient address."),
  agent: z
    .string()
    .optional()
    .describe("Filter by agent UUID."),
};

export function registerListTransactions(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "list-transactions",
    "List payment transactions for your merchant account with filtering and pagination. " +
      "Returns chain, amount, status, gas costs, and timestamps. " +
      "Requires a PincerPay API key.",
    inputSchema,
    { title: "List transactions", readOnlyHint: true, openWorldHint: true },
    async ({ limit, offset, status, chain, from, to, agent }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.listTransactions({ limit, offset, status, chain, from, to, agent });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to list transactions: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
