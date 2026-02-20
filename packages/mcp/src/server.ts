import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FacilitatorClient } from "./client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

export interface PincerPayMcpConfig {
  /** PincerPay API key (pp_live_... or pp_test_...) */
  apiKey?: string;
  /** Facilitator URL (defaults to https://facilitator.pincerpay.com) */
  facilitatorUrl?: string;
}

/**
 * Create a configured PincerPay MCP server with all tools,
 * resources, and prompts registered.
 *
 * Tools that don't require auth (scaffolding, gas estimates,
 * chain listing) work without an API key. Operations tools
 * (transaction status) require a key and return a helpful error
 * if none is configured.
 */
export function createPincerPayMcpServer(config: PincerPayMcpConfig = {}) {
  const server = new McpServer(
    {
      name: "pincerpay",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  const client = new FacilitatorClient({
    apiKey: config.apiKey,
    facilitatorUrl: config.facilitatorUrl,
  });

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}
