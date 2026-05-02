import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateMerchantWallets } from "@pincerpay/onboarding";

const inputSchema = {
  strength: z
    .enum(["12", "24"])
    .default("12")
    .describe("Mnemonic word count. 12 is standard for Phantom + MetaMask."),
  mnemonic: z
    .string()
    .optional()
    .describe(
      "Optional existing BIP-39 mnemonic. If supplied, addresses are re-derived rather than freshly generated. " +
        "Useful for verifying that a backup matches.",
    ),
  includePrivateKeys: z
    .boolean()
    .default(false)
    .describe(
      "When true, includes Solana + EVM private keys in the response. " +
        "Default false — most callers only need the mnemonic and addresses.",
    ),
};

export function registerBootstrapWallets(server: McpServer) {
  server.tool(
    "bootstrap-wallets",
    "Generates a non-custodial merchant wallet set: one BIP-39 mnemonic plus Solana + EVM " +
      "addresses derived from it. Phantom and MetaMask compatible (Solana m/44'/501'/0'/0', " +
      "EVM m/44'/60'/0'/0/0). Pure client-side crypto — PincerPay never sees the keys. " +
      "Use this before bootstrap-merchant to provision wallets, or independently to generate " +
      "any new keypair set.",
    inputSchema,
    async ({ strength, mnemonic, includePrivateKeys }) => {
      try {
        const wallets = await generateMerchantWallets({
          strength: strength === "24" ? 256 : 128,
          mnemonic,
        });

        const safe = {
          mnemonic: wallets.mnemonic,
          solana: includePrivateKeys
            ? wallets.solana
            : { address: wallets.solana.address, derivationPath: wallets.solana.derivationPath },
          evm: includePrivateKeys
            ? wallets.evm
            : { address: wallets.evm.address, derivationPath: wallets.evm.derivationPath },
          warning:
            "Save the mnemonic somewhere durable. PincerPay does not store it. " +
            "If lost, any USDC sent to these addresses is unrecoverable.",
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(safe, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to generate wallets: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
