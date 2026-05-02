import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bootstrapMerchant, generateMerchantWallets } from "@pincerpay/onboarding";

const inputSchema = {
  name: z.string().min(1).describe("Display name for the merchant."),
  authUserId: z
    .string()
    .min(1)
    .describe(
      "Supabase Auth user id that owns this merchant record. " +
        "On the live PincerPay deployment this is a UUID created by Supabase Auth on signup.",
    ),
  mnemonic: z
    .string()
    .optional()
    .describe(
      "Optional existing BIP-39 mnemonic. If omitted, a fresh 12-word mnemonic is generated.",
    ),
  webhookUrl: z.string().url().optional().describe("Webhook delivery URL."),
  apiKeyLabel: z.string().default("Bootstrap").describe("Label for the API key."),
  supportedChains: z
    .array(z.string())
    .default(["solana", "polygon"])
    .describe("Chains the merchant will settle on."),
};

export function registerBootstrapMerchant(server: McpServer) {
  server.tool(
    "bootstrap-merchant",
    "End-to-end merchant onboarding: generates non-custodial wallets, inserts a merchant row, " +
      "and provisions an API key in one call. Returns mnemonic, addresses, raw API key, and " +
      "webhook secret. PincerPay never persists the mnemonic or private keys; the caller is " +
      "responsible for displaying + discarding them. " +
      "REQUIRES DATABASE_URL env var on the MCP server. Returns a helpful error otherwise. " +
      "Intended for self-hosted / admin contexts, not public MCP usage.",
    inputSchema,
    async (args) => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "DATABASE_URL is not set on the MCP server. " +
                "bootstrap-merchant writes to PincerPay's database and is only available in " +
                "self-hosted / admin deployments. For public-facing onboarding, use " +
                "bootstrap-wallets to generate keys, then sign up at https://pincerpay.com.",
            },
          ],
          isError: true,
        };
      }

      try {
        const wallets = await generateMerchantWallets({ mnemonic: args.mnemonic });

        const result = await bootstrapMerchant({
          databaseUrl,
          name: args.name,
          authUserId: args.authUserId,
          wallets,
          walletAddresses: { solana: wallets.solana.address, evm: wallets.evm.address },
          supportedChains: args.supportedChains,
          webhookUrl: args.webhookUrl,
          apiKeyLabel: args.apiKeyLabel,
        });

        const payload = {
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
          warning:
            "The mnemonic, private keys, raw API key, and webhook secret are returned ONCE. " +
            "Save them now. None of them is recoverable.",
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `bootstrap-merchant failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
