import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMerchantPrompt(server: McpServer) {
  server.prompt(
    "integrate-merchant",
    "Step-by-step guide for adding x402 USDC paywalls to your API. " +
      "Generates middleware code, environment setup, and testing instructions.",
    {
      framework: z
        .enum(["express", "hono", "nextjs"])
        .describe(
          "Web framework to use. Use 'nextjs' for Next.js App Router (Hono adapter).",
        ),
      chain: z
        .string()
        .default("solana")
        .describe("Primary chain."),
      endpoints: z
        .string()
        .describe(
          "Comma-separated list of endpoints with prices, e.g. " +
            "'GET /api/weather:0.01, GET /api/premium:0.10'",
        ),
    },
    ({ framework, chain, endpoints }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to add PincerPay USDC paywalls to my ${framework} API.

Chain: ${chain}
Endpoints: ${endpoints}

Please:
1. Use the scaffold-x402-middleware tool to generate the middleware code
2. Use validate-payment-config to verify the configuration
3. Use list-supported-chains to confirm the chain is valid
4. Use generate-ucp-manifest to create a discovery manifest
5. Explain how to get an API key from pincerpay.com/dashboard
6. Show how to test with the agent SDK on a testnet chain`,
          },
        },
      ],
    }),
  );
}
