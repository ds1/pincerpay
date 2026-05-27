import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  limit: z.number().int().min(1).max(200).default(50).describe("Max items to return."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset."),
  status: z
    .string()
    .optional()
    .describe("Filter by status: active, paused, revoked."),
};

export function registerListAgents(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "list-agents",
    "List AI agents that have interacted with your merchant account. " +
      "Shows Solana address, spending limits, Squads PDA, and status. " +
      "Agents are auto-registered on first payment. Requires a PincerPay API key.",
    inputSchema,
    { title: "List agents", readOnlyHint: true, openWorldHint: true },
    async ({ limit, offset, status }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.listAgents({ limit, offset, status });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to list agents: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
