import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  id: z.string().uuid().describe("Paywall UUID to update."),
  amount: z
    .string()
    .optional()
    .describe('New USDC price, e.g. "0.05".'),
  description: z
    .string()
    .optional()
    .describe("New description."),
  chains: z
    .array(z.string())
    .optional()
    .describe("New chain overrides."),
  isActive: z
    .boolean()
    .optional()
    .describe("Set to false to disable the paywall without deleting it."),
};

export function registerUpdatePaywall(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "update-paywall",
    "Update an existing paywall's price, description, chains, or active status. " +
      "Only provided fields are changed. Requires a PincerPay API key.",
    inputSchema,
    { title: "Update paywall", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ id, amount, description, chains, isActive }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.updatePaywall(id, { amount, description, chains, isActive });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to update paywall: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
