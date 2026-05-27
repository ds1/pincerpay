import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

export function registerCheckHealth(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "check-facilitator-health",
    "Check whether the PincerPay facilitator is reachable and healthy. " +
      "Returns database status, worker health, uptime, and Kora (gasless) status. " +
      "No API key required. Use this as the first troubleshooting step.",
    {},
    { title: "Check facilitator health", readOnlyHint: true, openWorldHint: true },
    async () => {
      try {
        const result = await client.getHealth();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to reach facilitator: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
