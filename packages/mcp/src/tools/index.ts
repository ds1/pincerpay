import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";
import { registerListChains } from "./list-chains.js";
import { registerEstimateGas } from "./estimate-gas.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerCheckTransaction } from "./check-transaction.js";
import { registerScaffoldMiddleware } from "./scaffold-middleware.js";
import { registerScaffoldAgent } from "./scaffold-agent.js";
import { registerGenerateUcp } from "./generate-ucp.js";

export function registerTools(server: McpServer, client: FacilitatorClient) {
  // Operations tools (facilitator interaction)
  registerListChains(server, client);
  registerCheckTransaction(server, client);
  registerEstimateGas(server);

  // Developer tools (scaffolding + validation)
  registerValidateConfig(server);
  registerScaffoldMiddleware(server);
  registerScaffoldAgent(server);
  registerGenerateUcp(server);
}
