import type { PincerPayConfig } from "@pincerpay/core";
import { resolveChain, DEFAULT_FACILITATOR_URL } from "@pincerpay/core";
import {
  paymentMiddlewareFromConfig,
  type PaywallConfig,
} from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

/**
 * Express middleware factory — the dead-simple API from the plan:
 *
 * ```ts
 * app.use(pincerpay({
 *   apiKey: process.env.PINCERPAY_API_KEY!,
 *   merchantAddress: "0xYourAddress",
 *   routes: {
 *     "GET /api/weather": { price: "0.01", chain: "base", description: "Weather data" },
 *   },
 * }));
 * ```
 */
export function pincerpay(config: PincerPayConfig, paywallConfig?: PaywallConfig) {
  const facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;

  // Build x402-compatible routes config
  // Pass price as Money (string) so the EVM server scheme handles conversion
  // and automatically includes EIP-712 domain parameters (name, version)
  const x402Routes: Record<string, {
    accepts: Array<{
      scheme: string;
      network: Network;
      payTo: string;
      price: string;
      maxTimeoutSeconds: number;
    }>;
    description: string;
  }> = {};

  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    const chains = routeConfig.chains ?? (routeConfig.chain ? [routeConfig.chain] : ["solana"]);

    const accepts = chains.map((chainShorthand) => {
      const chain = resolveChain(chainShorthand);
      if (!chain) throw new Error(`Unknown chain: ${chainShorthand}`);

      return {
        scheme: "exact" as const,
        network: chain.caip2Id as Network,
        payTo: config.merchantAddress,
        price: routeConfig.price,
        maxTimeoutSeconds: 300,
      };
    });

    x402Routes[pattern] = {
      accepts,
      description: routeConfig.description ?? pattern,
    };
  }

  // Create facilitator client pointing to PincerPay
  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    createAuthHeaders: async () => ({
      verify: { "x-pincerpay-api-key": config.apiKey },
      settle: { "x-pincerpay-api-key": config.apiKey },
      supported: { "x-pincerpay-api-key": config.apiKey },
    }),
  });

  // Register server schemes so the resource server can build payment requirements
  const schemes = [
    { network: "eip155:*" as Network, server: new ExactEvmScheme() },
    { network: "solana:*" as Network, server: new ExactSvmScheme() },
  ];

  return paymentMiddlewareFromConfig(
    x402Routes,
    facilitatorClient,
    schemes,
    paywallConfig,
    undefined, // paywall provider
    config.syncFacilitatorOnStart ?? true,
  );
}

export { PincerPayClient } from "../client.js";
