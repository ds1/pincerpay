import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApiKey, listMerchantsAll } from "@pincerpay/onboarding";
import { authModeErrorMessage, resolveAuthMode } from "../auth-mode.js";
import { createOnboardingClient, OnboardingApiError } from "../onboarding-client.js";

const createSchema = {
  merchant: z
    .string()
    .optional()
    .describe(
      "Merchant UUID or case-insensitive name. Required in admin (DATABASE_URL) mode. " +
        "Ignored in public mode — the merchant is inferred from the CLI session.",
    ),
  label: z.string().default("MCP").describe("Label shown on the API key in the dashboard."),
};

export function registerCreateApiKey(server: McpServer) {
  server.tool(
    "create-api-key",
    "Mints a new pp_live_* API key for the current merchant. The raw key is returned ONCE. " +
      "Auth modes: (1) admin if DATABASE_URL is set, requires --merchant; (2) public if " +
      "~/.pincerpay/credentials.json exists, mints for the logged-in user's merchant.",
    createSchema,
    async ({ merchant, label }) => {
      const auth = resolveAuthMode();

      if (auth.mode === "none") {
        return {
          content: [{ type: "text" as const, text: authModeErrorMessage() }],
          isError: true,
        };
      }

      try {
        if (auth.mode === "admin") {
          if (!merchant) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "merchant (UUID or name) is required in admin mode (DATABASE_URL).",
                },
              ],
              isError: true,
            };
          }
          const result = await createApiKey({
            databaseUrl: auth.databaseUrl,
            merchant,
            label,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    mode: "admin",
                    merchantId: result.merchantId,
                    merchantName: result.merchantName,
                    apiKey: { raw: result.rawKey, prefix: result.prefix, label: result.label },
                    warning: "The raw key is returned ONCE.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Public mode
        const client = createOnboardingClient(auth.credentials);
        const result = await client.request<{
          id: string;
          rawKey: string;
          prefix: string;
          label: string;
        }>("POST", "/v1/onboarding/api-keys", { label });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "public",
                  apiKey: { id: result.id, raw: result.rawKey, prefix: result.prefix, label: result.label },
                  warning: "The raw key is returned ONCE.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const status = err instanceof OnboardingApiError ? err.status : "?";
        return {
          content: [
            {
              type: "text" as const,
              text: `create-api-key failed [${status}]: ${err instanceof Error ? err.message : String(err)}`,
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
    "Admin mode (DATABASE_URL): lists all merchants in the database. " +
      "Public mode (CLI credentials): returns only the caller's own merchant.",
    {},
    async () => {
      const auth = resolveAuthMode();

      if (auth.mode === "none") {
        return {
          content: [{ type: "text" as const, text: authModeErrorMessage() }],
          isError: true,
        };
      }

      try {
        if (auth.mode === "admin") {
          const rows = await listMerchantsAll(auth.databaseUrl);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ mode: "admin", merchants: rows }, null, 2) },
            ],
          };
        }

        const client = createOnboardingClient(auth.credentials);
        const merchant = await client.request<{
          merchantId?: string;
          name?: string;
          walletAddress?: string;
          supportedChains?: string[];
        }>("GET", "/v1/onboarding/merchant").catch((err: unknown) => {
          if (err instanceof OnboardingApiError && err.status === 404) {
            return null;
          }
          throw err;
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "public",
                  merchants: merchant ? [merchant] : [],
                  note: merchant
                    ? "Public mode shows only your own merchant."
                    : "No merchant exists yet for this user. Run bootstrap-merchant.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const status = err instanceof OnboardingApiError ? err.status : "?";
        return {
          content: [
            {
              type: "text" as const,
              text: `list-merchants failed [${status}]: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
