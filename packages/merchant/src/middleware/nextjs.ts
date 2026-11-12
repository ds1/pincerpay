import type {
  PincerPayConfig,
  PincerPayPaymentInfo,
  PincerPayContextVariables,
} from "@pincerpay/core";
import {
  DEFAULT_FACILITATOR_URL,
  API_KEY_HEADER,
  FACILITATOR_ROUTES,
} from "@pincerpay/core";
import type { Context, Next } from "hono";
import {
  buildRouteAcceptsUnchecked,
  matchOfferedRequirement,
  mergeSupportedExtra,
  supportedExtraByNetwork,
  validateFeeBps,
} from "../requirements.js";
import type { PaymentRequirements, SupportedResponse } from "../requirements.js";

export type { PincerPayPaymentInfo, PincerPayContextVariables };

/** Middleware config: the shared `PincerPayConfig` plus an optional cut. */
export type PincerPayMiddlewareConfig = PincerPayConfig & {
  /**
   * PincerPay's cut in basis points, added on top of each route's price:
   * `amount = ceil(base * (10000 + feeBps) / 10000)`. Unset means 0, which
   * leaves every 402 exactly as before.
   */
  feeBps?: number;
};

/**
 * Lightweight Next.js / Hono middleware for PincerPay x402 paywalls.
 *
 * Zero @x402/*, viem, @solana/kit imports — settlement is delegated
 * entirely to the PincerPay facilitator via fetch().
 *
 * ```ts
 * // app/api/[...route]/route.ts
 * import { Hono } from "hono";
 * import { handle } from "hono/vercel";
 * import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";
 *
 * const app = new Hono().basePath("/api");
 *
 * app.use("*", createPincerPayMiddleware({
 *   apiKey: process.env.PINCERPAY_API_KEY!,
 *   merchantAddress: "YOUR_WALLET_ADDRESS",
 *   routes: {
 *     "GET /api/weather": { price: "0.01", chain: "solana", description: "Weather data" },
 *   },
 * }));
 *
 * app.get("/weather", (c) => c.json({ temp: 72 }));
 *
 * export const GET = handle(app);
 * export const POST = handle(app);
 * ```
 */
export function createPincerPayMiddleware(config: PincerPayMiddlewareConfig) {
  const feeBps = validateFeeBps(config.feeBps);

  // Normalize: strip trailing /v1 if present — FACILITATOR_ROUTES already include the version prefix
  const rawUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;
  const facilitatorUrl = rawUrl.replace(/\/v1\/?$/, "");

  // Warn if using devnet facilitator or default URL without explicit config
  if (!config.facilitatorUrl) {
    console.log(
      "[pincerpay] Using production facilitator:",
      DEFAULT_FACILITATOR_URL,
    );
  }

  // Fetch facilitator's supported schemes eagerly — provides correct `extra` fields
  // (e.g., Solana feePayer = facilitator's address, EVM EIP-712 domain params)
  const facilitatorExtraPromise: Promise<Map<string, Record<string, unknown>>> =
    fetch(`${facilitatorUrl}${FACILITATOR_ROUTES.supported}`)
      .then((res) => res.json())
      .then((data: Pick<SupportedResponse, "kinds">) => supportedExtraByNetwork(data))
      .catch(() => new Map<string, Record<string, unknown>>());

  // Pre-resolve chain configs at init time (extra fields filled lazily from facilitator)
  const resolvedRoutes = new Map<
    string,
    {
      description: string;
      accepts: PaymentRequirements[];
    }
  >();

  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    resolvedRoutes.set(pattern, {
      description: routeConfig.description ?? pattern,
      accepts: buildRouteAcceptsUnchecked(pattern, routeConfig, config, feeBps),
    });
  }

  // Once facilitator responds, merge its extra fields into resolved routes
  let facilitatorExtraResolved = false;
  facilitatorExtraPromise.then((extraMap) => {
    if (extraMap.size === 0) return;
    for (const route of resolvedRoutes.values()) {
      mergeSupportedExtra(route.accepts, extraMap, feeBps);
    }
    facilitatorExtraResolved = true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (c: Context, next: Next) => {
    const method = c.req.method;
    const path = c.req.path;
    const routeKey = `${method} ${path}`;
    const route = resolvedRoutes.get(routeKey);

    // Not a paywalled route — pass through
    if (!route) return next();

    // Ensure facilitator extra fields are resolved before returning 402
    if (!facilitatorExtraResolved) await facilitatorExtraPromise;

    // Check for x402 v2 payment signature header
    const paymentHeader =
      c.req.header("payment-signature") ?? c.req.header("x-payment");

    if (!paymentHeader) {
      // Return 402 Payment Required
      const paymentRequired = {
        x402Version: 2,
        error: "Payment required",
        resource: {
          resource: path,
          description: route.description,
          mimeType: "application/json",
        },
        accepts: route.accepts,
        extensions: {},
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      c.header("payment-required", encoded);
      return c.json(paymentRequired, 402);
    }

    // Payment header present — settle via facilitator
    try {
      // x402 may send as raw JSON or base64-encoded JSON
      let decoded: Record<string, unknown>;
      try {
        decoded = JSON.parse(paymentHeader);
      } catch {
        decoded = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString("utf-8"),
        );
      }

      // Never settle against terms the agent supplied. Find the requirement
      // this route actually offered that matches the agent's choice, and send
      // our own copy to the facilitator so it verifies the transfer against
      // the merchant's price and wallet.
      const paymentRequirements = matchOfferedRequirement(
        route.accepts,
        decoded.accepted ?? decoded.paymentRequirements,
      );

      if (!paymentRequirements) {
        return c.json(
          {
            error: "Payment settlement failed",
            reason: "payment_requirements_mismatch",
            message:
              "Payment does not match any payment option offered for this route.",
          },
          402,
        );
      }

      const settleRes = await fetch(
        `${facilitatorUrl}${FACILITATOR_ROUTES.settle}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [API_KEY_HEADER]: config.apiKey,
          },
          body: JSON.stringify({
            paymentPayload: decoded,
            paymentRequirements,
          }),
        },
      );

      const settle = (await settleRes.json()) as {
        success: boolean;
        transaction?: string;
        network?: string;
        payer?: string;
        errorReason?: string;
        errorMessage?: string;
      };

      if (!settle.success) {
        return c.json(
          {
            error: "Payment settlement failed",
            reason: settle.errorReason,
            message: settle.errorMessage,
          },
          402,
        );
      }

      // Payment succeeded — surface verified payer on the request context
      // so route handlers can attribute the action without re-decoding X-PAYMENT.
      const paymentInfo: PincerPayPaymentInfo = {
        payer: settle.payer ?? "",
        transaction: settle.transaction ?? "",
        network: settle.network ?? "",
      };
      c.set("pincerpay", paymentInfo);

      // Attach settlement response header (clients that bypass middleware
      // can read the canonical verified payer here too).
      const settleResponse = {
        x402Version: 2,
        success: true,
        transaction: paymentInfo.transaction,
        network: paymentInfo.network,
        payer: paymentInfo.payer,
      };
      c.header("payment-response", Buffer.from(JSON.stringify(settleResponse)).toString("base64"));

      return next();
    } catch (err) {
      console.error("[pincerpay] settlement error:", err);
      return c.json(
        { error: "Payment processing failed", detail: String(err) },
        500,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}
