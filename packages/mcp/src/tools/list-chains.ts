import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";
import { CHAINS } from "@pincerpay/core";

const inputSchema = {
  source: z
    .enum(["local", "facilitator"])
    .default("local")
    .describe(
      "'local' returns all known PincerPay chain configs. " +
        "'facilitator' queries the live facilitator for currently registered schemes.",
    ),
};

export function registerListChains(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "list-supported-chains",
    "Returns supported blockchain networks and their USDC configurations. " +
      "Includes Solana (primary), Base, and Polygon with mainnet/testnet variants. " +
      "Shows chain shorthand, CAIP-2 ID, USDC contract address, and block time.",
    inputSchema,
    async ({ source }) => {
      if (source === "facilitator") {
        try {
          const result = await client.getSupported();
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
                text: `Failed to reach facilitator: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      }

      const chains = Object.values(CHAINS).map((c) => ({
        shorthand: c.shorthand,
        name: c.name,
        caip2Id: c.caip2Id,
        namespace: c.namespace,
        usdcAddress: c.usdcAddress,
        usdcDecimals: c.usdcDecimals,
        testnet: c.testnet,
        explorerUrl: c.explorerUrl,
        blockTimeMs: c.blockTimeMs,
      }));

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(chains, null, 2) },
        ],
      };
    },
  );
}
