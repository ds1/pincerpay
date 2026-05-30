import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

export function registerGetMetrics(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "get-settlement-metrics",
    "Fetch performance metrics from the PincerPay facilitator. " +
      "Returns settlement counters, latency percentiles (p50/p95/p99), " +
      "verification stats, and error rates. No API key required.",
    {},
    { title: "Get settlement metrics", readOnlyHint: true, openWorldHint: true },
    async () => {
      try {
        const result = await client.getMetrics();
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
              text: `Failed to fetch metrics: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
