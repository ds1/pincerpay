import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  limit: z.number().int().min(1).max(200).default(50).describe("Max items to return."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset."),
  active: z
    .boolean()
    .optional()
    .describe("Filter by active status. Omit to return all."),
};

export function registerListPaywalls(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "list-paywalls",
    "List paywalled endpoints configured for your merchant account. " +
      "Returns endpoint patterns, USDC amounts, chain overrides, and active status. " +
      "Requires a PincerPay API key.",
    inputSchema,
    { title: "List paywalls", readOnlyHint: true, openWorldHint: true },
    async ({ limit, offset, active }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.listPaywalls({ limit, offset, active });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to list paywalls: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
