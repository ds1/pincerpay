import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PincerPayConfigSchema,
  resolveChain,
  resolveMerchantAddress,
  validateMerchantAddressForChain,
} from "@pincerpay/core";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
    { title: "Validate payment config", readOnlyHint: true, openWorldHint: false },
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
      // Schema errors don't stop the route-level checks: report everything
      // wrong with the config in one pass.
      const errors: string[] = result.success
        ? []
        : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      const warnings: string[] = [];

      const raw = isRecord(parsed) ? parsed : {};
      const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : undefined;
      const addresses = {
        merchantAddress: typeof raw.merchantAddress === "string" ? raw.merchantAddress : undefined,
        merchantAddresses: isRecord(raw.merchantAddresses)
          ? (raw.merchantAddresses as Record<string, string>)
          : undefined,
      };
      const routes = isRecord(raw.routes) ? raw.routes : {};

      if (apiKey && !apiKey.startsWith("pp_live_") && !apiKey.startsWith("pp_test_")) {
        warnings.push(
          "API key does not start with 'pp_live_' or 'pp_test_'. Verify it's correct.",
        );
      }

      const validMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
      const allChains = new Set<string>();
      for (const [pattern, routeValue] of Object.entries(routes)) {
        const route = isRecord(routeValue) ? routeValue : {};

        // Route pattern format: "METHOD /path". A malformed key never matches
        // a request, so the route would silently stay free.
        const parts = pattern.split(" ");
        if (parts.length < 2) {
          errors.push(
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
            errors.push(
              `Route "${pattern}": path must start with "/" (e.g., "GET /api/weather").`,
            );
          }
        }

        // Unknown chains, missing wallets and malformed addresses make the
        // middleware throw at init, so they are errors.
        const chains = Array.isArray(route.chains)
          ? route.chains.filter((c): c is string => typeof c === "string")
          : typeof route.chain === "string"
            ? [route.chain]
            : ["solana"];
        for (const chain of chains) {
          allChains.add(chain);
          if (!resolveChain(chain)) {
            errors.push(`Route "${pattern}": unknown chain "${chain}".`);
            continue;
          }

          const resolved = resolveMerchantAddress(addresses, chain);
          if (!resolved) {
            errors.push(
              `Route "${pattern}": no receiving wallet for chain "${chain}". ` +
                `Set merchantAddresses[${JSON.stringify(chain)}] or a legacy merchantAddress.`,
            );
            continue;
          }

          const formatError = validateMerchantAddressForChain(resolved, chain);
          if (formatError) {
            errors.push(`Route "${pattern}": ${formatError}`);
          }
        }

        const price = typeof route.price === "string" ? parseFloat(route.price) : NaN;
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

      const valid = errors.length === 0;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid,
                errors: valid ? undefined : errors,
                warnings: warnings.length > 0 ? warnings : undefined,
                routeCount: Object.keys(routes).length,
                chains: [...allChains],
              },
              null,
              2,
            ),
          },
        ],
        ...(valid ? {} : { isError: true }),
      };
    },
  );
}
