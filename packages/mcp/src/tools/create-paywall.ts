import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  endpointPattern: z
    .string()
    .min(1)
    .describe('HTTP method + path to paywall, e.g. "GET /api/weather".'),
  amount: z
    .string()
    .min(1)
    .describe('USDC price in human-readable format, e.g. "0.01".'),
  description: z
    .string()
    .optional()
    .describe("Optional description of what this endpoint provides."),
  chains: z
    .array(z.string())
    .optional()
    .describe("Override supported chains for this paywall. Omit to use merchant defaults."),
};

export function registerCreatePaywall(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "create-paywall",
    "Create a new paywalled endpoint. Sets the USDC price and optional chain restrictions. " +
      "The endpoint pattern must be unique per merchant. Requires a PincerPay API key.",
    inputSchema,
    { title: "Create paywall", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ endpointPattern, amount, description, chains }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.createPaywall({
          endpointPattern,
          amount,
          description,
          chains,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to create paywall: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
