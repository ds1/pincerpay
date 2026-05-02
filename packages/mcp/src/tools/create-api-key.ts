import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApiKey, listMerchantsAll } from "@pincerpay/onboarding";

const createSchema = {
  merchant: z
    .string()
    .min(1)
    .describe(
      "Merchant UUID or case-insensitive name. Run list-merchants to see options.",
    ),
  label: z.string().default("MCP").describe("Label shown on the API key in the dashboard."),
};

export function registerCreateApiKey(server: McpServer) {
  server.tool(
    "create-api-key",
    "Mints a new API key for an existing PincerPay merchant. The raw key is returned ONCE " +
      "and is never recoverable — save it immediately. " +
      "REQUIRES DATABASE_URL env var on the MCP server (admin context).",
    createSchema,
    async ({ merchant, label }) => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "DATABASE_URL is not set on the MCP server. create-api-key writes to PincerPay's " +
                "database and is only available in self-hosted / admin deployments.",
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await createApiKey({ databaseUrl, merchant, label });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  merchantId: result.merchantId,
                  merchantName: result.merchantName,
                  apiKey: { raw: result.rawKey, prefix: result.prefix, label: result.label },
                  warning: "The raw key is returned ONCE. Save it immediately.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `create-api-key failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

export function registerListMerchants(server: McpServer) {
  server.tool(
    "list-merchants",
    "Lists all merchants in the PincerPay database. " +
      "REQUIRES DATABASE_URL env var on the MCP server (admin context).",
    {},
    async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "DATABASE_URL is not set on the MCP server. list-merchants reads from " +
                "PincerPay's database and is only available in self-hosted / admin deployments.",
            },
          ],
          isError: true,
        };
      }

      try {
        const rows = await listMerchantsAll(databaseUrl);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `list-merchants failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
