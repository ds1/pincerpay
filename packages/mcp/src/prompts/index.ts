import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMerchantPrompt } from "./integrate-merchant.js";
import { registerAgentPrompt } from "./integrate-agent.js";
import { registerDebugPrompt } from "./debug-transaction.js";

export function registerPrompts(server: McpServer) {
  registerMerchantPrompt(server);
  registerAgentPrompt(server);
  registerDebugPrompt(server);
}
