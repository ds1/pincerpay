import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  id: z.string().uuid().describe("Paywall UUID to delete."),
  confirm: z
    .boolean()
    .default(false)
    .describe(
      "Must be set to true to actually delete. This is a destructive, " +
        "irreversible operation; the tool refuses to run without explicit confirmation.",
    ),
};

export function registerDeletePaywall(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "delete-paywall",
    "Permanently delete a paywalled endpoint. This cannot be undone. " +
      "Use update-paywall with isActive=false to disable without deleting. " +
      "Requires a PincerPay API key. Pass confirm=true to proceed.",
    inputSchema,
    { title: "Delete paywall", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    async ({ id, confirm }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      if (!confirm) {
        return {
          content: [{ type: "text" as const, text: `Refusing to delete paywall ${id}: this is irreversible. Re-run with confirm=true to proceed, or use update-paywall with isActive=false to disable it instead.` }],
          isError: true,
        };
      }

      try {
        await client.deletePaywall(id);
        return {
          content: [{ type: "text" as const, text: `Paywall ${id} deleted successfully.` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to delete paywall: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
