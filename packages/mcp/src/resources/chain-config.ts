import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHAINS } from "@pincerpay/core";

export function registerChainResources(server: McpServer) {
  server.resource(
    "chain-config",
    new ResourceTemplate("chain://{shorthand}", {
      list: async () => ({
        resources: Object.values(CHAINS).map((c) => ({
          uri: `chain://${c.shorthand}`,
          name: `${c.name} (${c.shorthand})`,
          description: `${c.testnet ? "Testnet" : "Mainnet"} — USDC: ${c.usdcAddress.slice(0, 10)}...`,
          mimeType: "application/json" as const,
        })),
      }),
    }),
    async (uri, { shorthand }) => {
      const chain = CHAINS[shorthand as string];
      if (!chain) {
        throw new Error(
          `Unknown chain: "${shorthand}". Valid: ${Object.keys(CHAINS).join(", ")}`,
        );
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(chain, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );
}
