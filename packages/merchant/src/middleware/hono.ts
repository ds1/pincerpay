import type { PincerPayConfig } from "@pincerpay/core";
import { resolveChain } from "@pincerpay/core";
import { toBaseUnits } from "../client.js";
import {
  paymentMiddlewareFromConfig,
  type PaywallConfig,
} from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";

/**
 * Hono middleware factory for PincerPay merchants.
 *
 * ```ts
 * app.use("*", pincerpayHono({
 *   apiKey: process.env.PINCERPAY_API_KEY!,
 *   merchantAddress: "0xYourAddress",
 *   routes: {
 *     "GET /api/weather": { price: "0.01", chain: "base", description: "Weather data" },
 *   },
 * }));
 * ```
 */
export function pincerpayHono(config: PincerPayConfig, paywallConfig?: PaywallConfig) {
  const facilitatorUrl = config.facilitatorUrl ?? "https://facilitator.pincerpay.com";

  // Build x402-compatible routes config
  const x402Routes: Record<string, {
    accepts: Array<{
      scheme: string;
      network: Network;
      payTo: string;
      price: { amount: string; asset: string };
      maxTimeoutSeconds: number;
    }>;
    description: string;
  }> = {};

  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    const chains = routeConfig.chains ?? (routeConfig.chain ? [routeConfig.chain] : ["base"]);
    const amount = toBaseUnits(routeConfig.price);

    const accepts = chains.map((chainShorthand) => {
      const chain = resolveChain(chainShorthand);
      if (!chain) throw new Error(`Unknown chain: ${chainShorthand}`);

      return {
        scheme: "exact" as const,
        network: chain.caip2Id as Network,
        payTo: config.merchantAddress,
        price: {
          amount,
          asset: chain.usdcAddress,
        },
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

  return paymentMiddlewareFromConfig(
    x402Routes,
    facilitatorClient,
    undefined, // schemes
    paywallConfig,
  );
}

export { PincerPayClient } from "../client.js";
