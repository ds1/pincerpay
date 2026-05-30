import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

export function registerGetMerchantProfile(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "get-merchant-profile",
    "Fetch your merchant profile including wallet address, supported chains, " +
      "webhook URL, and on-chain registration status. Requires a PincerPay API key.",
    {},
    { title: "Get merchant profile", readOnlyHint: true, openWorldHint: true },
    async () => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        };
      }

      try {
        const result = await client.getMerchantProfile();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed to fetch merchant profile: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
