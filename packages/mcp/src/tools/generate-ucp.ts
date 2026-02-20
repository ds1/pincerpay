import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveChain, CHAINS } from "@pincerpay/core";

const inputSchema = {
  merchantName: z.string().describe("Business or project name."),
  merchantUrl: z
    .string()
    .url()
    .describe("Base URL of the merchant API (e.g., 'https://api.example.com')."),
  walletAddress: z
    .string()
    .describe("Merchant's USDC wallet address."),
  chains: z
    .array(z.string())
    .default(["solana"])
    .describe(
      `Supported chain shorthands. Valid: ${Object.keys(CHAINS).join(", ")}`,
    ),
  endpoints: z
    .array(
      z.object({
        path: z.string().describe("API path, e.g. '/api/weather'."),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .default("GET"),
        price: z.string().describe("USDC price, e.g. '0.01'."),
        description: z.string().describe("What this endpoint provides."),
      }),
    )
    .min(1)
    .describe("Paywalled endpoints to advertise."),
};

export function registerGenerateUcp(server: McpServer) {
  server.tool(
    "generate-ucp-manifest",
    "Generate a /.well-known/ucp JSON manifest for agent-readable commerce discovery. " +
      "UCP (Universal Commerce Protocol) lets AI agents discover your API's " +
      "payment requirements, supported chains, and endpoint pricing. " +
      "Place the output at /.well-known/ucp on your domain.",
    inputSchema,
    async ({ merchantName, merchantUrl, walletAddress, chains, endpoints }) => {
      const errors: string[] = [];
      const chainConfigs = chains.map((c) => {
        const config = resolveChain(c);
        if (!config) {
          errors.push(`Unknown chain: "${c}"`);
          return null;
        }
        return {
          network: config.caip2Id,
          token: "USDC",
          tokenAddress: config.usdcAddress,
        };
      });

      if (errors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: errors.join("\n") +
                `\nValid chains: ${Object.keys(CHAINS).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const manifest = {
        version: "1.0",
        merchant: {
          name: merchantName,
          url: merchantUrl,
        },
        payment: {
          handler: "pincerpay",
          facilitator: "https://facilitator.pincerpay.com",
          chains: chainConfigs,
          payTo: walletAddress,
        },
        endpoints: endpoints.map((ep) => ({
          path: ep.path,
          method: ep.method,
          price: { amount: ep.price, currency: "USDC" },
          description: ep.description,
        })),
      };

      const manifestJson = JSON.stringify(manifest, null, 2);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `## UCP Manifest\n\n` +
              `Serve this JSON at \`${merchantUrl}/.well-known/ucp\`:\n\n` +
              `\`\`\`json\n${manifestJson}\n\`\`\`\n\n` +
              `### How to Serve\n\n` +
              `**Express:**\n` +
              `\`\`\`typescript\n` +
              `app.get("/.well-known/ucp", (req, res) => {\n` +
              `  res.json(${JSON.stringify(manifest)});\n` +
              `});\n` +
              `\`\`\`\n\n` +
              `**Hono:**\n` +
              `\`\`\`typescript\n` +
              `app.get("/.well-known/ucp", (c) => c.json(${JSON.stringify(manifest)}));\n` +
              `\`\`\`\n\n` +
              `AI agents discover this manifest to learn what your API offers,\n` +
              `which chains you accept, and how much each endpoint costs.`,
          },
        ],
      };
    },
  );
}
