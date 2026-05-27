import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  limit: z.number().int().min(1).max(200).default(50).describe("Max items to return."),
  offset: z.number().int().min(0).default(0).describe("Pagination offset."),
  status: z
    .string()
    .optional()
    .describe("Filter by status: pending, delivered, retrying, failed."),
  event: z
    .string()
    .optional()
    .describe('Filter by event type, e.g. "payment.settled", "payment.confirmed", "payment.failed".'),
};

export function registerListWebhooks(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "list-webhooks",
    "List webhook delivery attempts for your merchant account. " +
      "Shows event type, HTTP status code, retry count, and delivery status. " +
      "Useful for diagnosing missed webhook notifications. Requires a PincerPay API key.",
    inputSchema,
    { title: "List webhooks", readOnlyHint: true, openWorldHint: true },
    async ({ limit, offset, status, event }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.listWebhooks({ limit, offset, status, event });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to list webhooks: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
