import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";
import { registerChainResources } from "./chain-config.js";
import { registerOpenApiResource } from "./openapi-spec.js";
import { registerDocsResources } from "./docs.js";

export function registerResources(
  server: McpServer,
  client: FacilitatorClient,
) {
  registerChainResources(server);
  registerOpenApiResource(server, client);
  registerDocsResources(server);
}
