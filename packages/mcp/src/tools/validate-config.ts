import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PincerPayConfigSchema,
  resolveChain,
  resolveMerchantAddress,
  validateMerchantAddressForChain,
} from "@pincerpay/core";

const inputSchema = {
  config: z.string().describe(
    "JSON string of a PincerPayConfig object to validate. " +
      "Must include apiKey, routes, and at least one of merchantAddress (single-chain legacy) " +
      "or merchantAddresses (per-chain map). Example: " +
      '\'{"apiKey":"pp_live_x","merchantAddresses":{"solana":"...","polygon":"0x..."},"routes":{"GET /api":{"price":"0.01","chain":"solana"}}}\'',
  ),
};

export function registerValidateConfig(server: McpServer) {
  server.tool(
    "validate-payment-config",
    "Validate a PincerPay merchant configuration object. " +
      "Checks API key format, merchant address, route patterns, " +
      "chain names, and USDC amounts. Returns validation results " +
      "with specific error messages for each issue found.",
    inputSchema,
    async ({ config }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(config);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                valid: false,
                errors: ["Invalid JSON: could not parse config string"],
              }),
            },
          ],
          isError: true,
        };
      }

      const result = PincerPayConfigSchema.safeParse(parsed);
      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  valid: false,
                  errors: result.error.issues.map(
                    (i) => `${i.path.join(".")}: ${i.message}`,
                  ),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const warnings: string[] = [];
      const data = result.data;

      if (
        !data.apiKey.startsWith("pp_live_") &&
        !data.apiKey.startsWith("pp_test_")
      ) {
        warnings.push(
          "API key does not start with 'pp_live_' or 'pp_test_'. Verify it's correct.",
        );
      }

      const validMethods = new Set([
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
      ]);
      const allChains = new Set<string>();
      for (const [pattern, route] of Object.entries(data.routes)) {
        // Validate route pattern format: "METHOD /path"
        const parts = pattern.split(" ");
        if (parts.length < 2) {
          warnings.push(
            `Route "${pattern}": invalid format. Must be "METHOD /path" (e.g., "GET /api/weather").`,
          );
        } else {
          const method = parts[0]!;
          const path = parts.slice(1).join(" ");
          if (!validMethods.has(method)) {
            warnings.push(
              `Route "${pattern}": "${method}" is not a standard HTTP method. Expected: GET, POST, PUT, DELETE, or PATCH.`,
            );
          }
          if (!path.startsWith("/")) {
            warnings.push(
              `Route "${pattern}": path must start with "/" (e.g., "GET /api/weather").`,
            );
          }
        }

        const chains =
          route.chains ?? (route.chain ? [route.chain] : ["solana"]);
        for (const chain of chains) {
          allChains.add(chain);
          if (!resolveChain(chain)) {
            warnings.push(`Route "${pattern}": unknown chain "${chain}".`);
            continue;
          }

          // Verify a receiving wallet exists for this chain — surfaces
          // missing per-chain entries before middleware init throws at runtime.
          const resolved = resolveMerchantAddress(data, chain);
          if (!resolved) {
            warnings.push(
              `Route "${pattern}": no receiving wallet for chain "${chain}". ` +
                `Set merchantAddresses[${JSON.stringify(chain)}] or a legacy merchantAddress.`,
            );
            continue;
          }

          const formatError = validateMerchantAddressForChain(resolved, chain);
          if (formatError) {
            warnings.push(`Route "${pattern}": ${formatError}`);
          }
        }

        const price = parseFloat(route.price);
        if (price === 0) {
          warnings.push(
            `Route "${pattern}": price is 0 — endpoint will effectively be free.`,
          );
        }
        if (price > 100) {
          warnings.push(
            `Route "${pattern}": price $${price} is unusually high for an API call.`,
          );
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid: true,
                warnings: warnings.length > 0 ? warnings : undefined,
                routeCount: Object.keys(data.routes).length,
                chains: [...allChains],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
