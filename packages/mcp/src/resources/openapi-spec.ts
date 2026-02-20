import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

export function registerOpenApiResource(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.resource(
    "openapi-spec",
    "pincerpay://openapi",
    async (uri) => {
      try {
        const spec = await client.getOpenApiSpec();
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(spec, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              text: `Failed to fetch OpenAPI spec: ${err instanceof Error ? err.message : String(err)}`,
              mimeType: "text/plain",
            },
          ],
        };
      }
    },
  );
}
