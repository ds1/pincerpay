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
      instructions:
        "PincerPay is an on-chain USDC payment gateway for AI agents — no card rails, " +
        "pure stablecoin settlement via the x402 protocol (HTTP 402). Solana is the primary " +
        "chain; Base and Polygon are optional EVM alternatives.\n\n" +
        "ROLE ROUTING: When a user wants to integrate PincerPay, first determine their role:\n" +
        "- Merchant (accept payments): use the `integrate-merchant` prompt → scaffold-x402-middleware → validate-payment-config → generate-ucp-manifest\n" +
        "- Agent developer (make payments): use the `integrate-agent` prompt → scaffold-agent-client → estimate-gas-cost\n" +
        "- Unclear: use the `get-started` prompt to triage\n" +
        "- Debugging: use the `debug-transaction` prompt\n\n" +
        "KEY GOTCHAS to always warn about:\n" +
        "1. Route `price` uses human-readable USDC (\"0.01\"), but spending `policies` use base units with 6 decimals (\"10000\" = $0.01). Using \"0.10\" in a policy causes BigInt() to throw.\n" +
        "2. ESM required: \"type\": \"module\" in package.json — SDKs are ESM-only.\n" +
        "3. Security: .gitignore must include .env* — never commit API keys or private keys.\n" +
        "4. Use devnet chains for testing (solana-devnet, base-sepolia).\n\n" +
        "Docs resources: docs://pincerpay/getting-started, docs://pincerpay/merchant, " +
        "docs://pincerpay/agent, docs://pincerpay/troubleshooting, docs://pincerpay/reference.",
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
