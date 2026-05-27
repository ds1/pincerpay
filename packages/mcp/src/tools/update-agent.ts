import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  id: z.string().uuid().describe("Agent UUID to update."),
  name: z
    .string()
    .optional()
    .describe("New display name for the agent."),
  status: z
    .enum(["active", "paused", "revoked"])
    .optional()
    .describe("Change agent status. Paused/revoked agents are blocked from payments."),
  maxPerTransaction: z
    .string()
    .optional()
    .describe('Max USDC per transaction in base units (e.g. "1000000" = $1).'),
  maxPerDay: z
    .string()
    .optional()
    .describe('Max USDC per day in base units (e.g. "10000000" = $10).'),
};

export function registerUpdateAgent(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "update-agent",
    "Update an agent's name, status, or spending limits. " +
      "Set status to 'paused' or 'revoked' to block further payments. " +
      "Spending limits are in USDC base units (6 decimals). Requires a PincerPay API key.",
    inputSchema,
    { title: "Update agent", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ id, name, status, maxPerTransaction, maxPerDay }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.updateAgent(id, { name, status, maxPerTransaction, maxPerDay });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to update agent: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
