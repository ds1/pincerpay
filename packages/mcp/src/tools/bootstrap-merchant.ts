import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bootstrapMerchant, generateMerchantWallets } from "@pincerpay/onboarding";
import { authModeErrorMessage, resolveAuthMode } from "../auth-mode.js";
import { createOnboardingClient, OnboardingApiError } from "../onboarding-client.js";

const inputSchema = {
  name: z.string().min(1).describe("Display name for the merchant."),
  authUserId: z
    .string()
    .optional()
    .describe(
      "Supabase Auth user id that owns this merchant record. " +
        "ONLY used in admin (DATABASE_URL) mode. In public mode (CLI credentials), " +
        "the auth user id is derived from the bearer token automatically.",
    ),
  mnemonic: z
    .string()
    .optional()
    .describe("Optional existing BIP-39 mnemonic. If omitted, a fresh 12-word mnemonic is generated."),
  webhookUrlLive: z.string().url().optional().describe("Live-mode webhook delivery URL."),
  webhookUrlTest: z.string().url().optional().describe("Test-mode webhook delivery URL."),
  apiKeyLabel: z.string().default("Bootstrap").describe("Label for the API key."),
  supportedChains: z
    .array(z.string())
    .default(["solana", "polygon"])
    .describe("Chains the merchant will settle on."),
};

export function registerBootstrapMerchant(server: McpServer) {
  server.tool(
    "bootstrap-merchant",
    "End-to-end merchant onboarding: generates non-custodial wallets, creates a merchant " +
      "record, and mints an API key in one call. Returns mnemonic + addresses + raw API key. " +
      "Auth modes: (1) admin if DATABASE_URL is set on the MCP server, (2) public if " +
      "~/.pincerpay/credentials.json exists (run `npx @pincerpay/cli login` first). " +
      "PincerPay never persists the mnemonic or private keys; the caller must display them once " +
      "and discard.",
    inputSchema,
    async (args) => {
      const auth = resolveAuthMode();

      if (auth.mode === "none") {
        return {
          content: [{ type: "text" as const, text: authModeErrorMessage() }],
          isError: true,
        };
      }

      try {
        const wallets = await generateMerchantWallets({ mnemonic: args.mnemonic });

        if (auth.mode === "admin") {
          if (!args.authUserId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "authUserId is required in admin mode (DATABASE_URL). In public mode it's inferred from the CLI session.",
                },
              ],
              isError: true,
            };
          }
          const result = await bootstrapMerchant({
            databaseUrl: auth.databaseUrl,
            name: args.name,
            authUserId: args.authUserId,
            wallets,
            walletAddresses: { solana: wallets.solana.address, evm: wallets.evm.address },
            supportedChains: args.supportedChains,
            webhookUrlLive: args.webhookUrlLive,
            webhookUrlTest: args.webhookUrlTest,
            apiKeyLabel: args.apiKeyLabel,
          });

          const payload = {
            mode: "admin",
            merchantId: result.merchantId,
            apiKey: {
              raw: result.apiKey.rawKey,
              prefix: result.apiKey.prefix,
              label: result.apiKey.label,
            },
            webhookSecret: result.webhookSecret,
            wallets: {
              mnemonic: result.wallets!.mnemonic,
              solana: result.wallets!.solana,
              evm: result.wallets!.evm,
            },
            envBlock: [
              `PINCERPAY_API_KEY=${result.apiKey.rawKey}`,
              `PINCERPAY_MERCHANT_ADDRESS_SOLANA=${result.wallets!.solana.address}`,
              `PINCERPAY_MERCHANT_ADDRESS_POLYGON=${result.wallets!.evm.address}`,
              `PINCERPAY_WEBHOOK_SECRET=${result.webhookSecret}`,
            ].join("\n"),
            warning: "Mnemonic, private keys, raw API key, webhook secret are shown ONCE.",
          };
          return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
        }

        // Public mode: hit the authenticated facilitator endpoints.
        const client = createOnboardingClient(auth.credentials);
        const merchant = await client.request<{
          merchantId: string;
          name: string;
          isNew: boolean;
        }>("POST", "/v1/onboarding/merchant/bootstrap", {
          name: args.name,
          walletAddresses: {
            solana: wallets.solana.address,
            evm: wallets.evm.address,
          },
          supportedChains: args.supportedChains,
          webhookUrlLive: args.webhookUrlLive,
          webhookUrlTest: args.webhookUrlTest,
        });

        const apiKey = await client.request<{
          rawKey: string;
          prefix: string;
          label: string;
        }>("POST", "/v1/onboarding/api-keys", { label: args.apiKeyLabel });

        const payload = {
          mode: "public",
          merchantId: merchant.merchantId,
          isNew: merchant.isNew,
          apiKey: {
            raw: apiKey.rawKey,
            prefix: apiKey.prefix,
            label: apiKey.label,
          },
          wallets: {
            mnemonic: wallets.mnemonic,
            solana: wallets.solana,
            evm: wallets.evm,
          },
          envBlock: [
            `PINCERPAY_API_KEY=${apiKey.rawKey}`,
            `PINCERPAY_MERCHANT_ADDRESS_SOLANA=${wallets.solana.address}`,
            `PINCERPAY_MERCHANT_ADDRESS_POLYGON=${wallets.evm.address}`,
          ].join("\n"),
          warning: "Mnemonic, private keys, raw API key are shown ONCE. Save them now.",
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
      } catch (err) {
        const status = err instanceof OnboardingApiError ? err.status : "?";
        return {
          content: [
            {
              type: "text" as const,
              text: `bootstrap-merchant failed [${status}]: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
