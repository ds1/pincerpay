import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  id: z.string().uuid().describe("Webhook delivery UUID to retry."),
};

export function registerRetryWebhook(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "retry-webhook",
    "Manually retry a failed or pending webhook delivery. " +
      "Resets the delivery status and queues it for immediate retry. " +
      "Cannot retry already-delivered webhooks. Requires a PincerPay API key.",
    inputSchema,
    { title: "Retry webhook delivery", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ id }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.retryWebhook(id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to retry webhook: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
