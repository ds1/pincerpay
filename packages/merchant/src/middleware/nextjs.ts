import type {
  PincerPayConfig,
  PincerPayPaymentInfo,
  PincerPayContextVariables,
} from "@pincerpay/core";
import {
  resolveChain,
  DEFAULT_FACILITATOR_URL,
  API_KEY_HEADER,
  FACILITATOR_ROUTES,
} from "@pincerpay/core";
import type { Context, Next } from "hono";

export type { PincerPayPaymentInfo, PincerPayContextVariables };

/**
 * Convert human-readable USDC price (e.g., "0.01") to base units (e.g., "10000").
 */
function toBaseUnits(amount: string): string {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(6, "0").slice(0, 6);
  const result = BigInt(whole) * BigInt(1_000_000) + BigInt(frac);
  return result.toString();
}

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
export function createPincerPayMiddleware(config: PincerPayConfig) {
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
      .then((data: { kinds: Array<{ network: string; extra?: Record<string, unknown> }> }) => {
        const map = new Map<string, Record<string, unknown>>();
        for (const kind of data.kinds) {
          if (kind.extra) map.set(kind.network, kind.extra);
        }
        return map;
      })
      .catch(() => new Map<string, Record<string, unknown>>());

  // Pre-resolve chain configs at init time (extra fields filled lazily from facilitator)
  type RouteAccept = {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, unknown>;
  };

  const resolvedRoutes = new Map<
    string,
    {
      description: string;
      accepts: RouteAccept[];
    }
  >();

  // Default extra fields per namespace (used as fallback if facilitator fetch fails)
  function defaultExtra(namespace: string): Record<string, unknown> {
    return namespace === "solana"
      ? { feePayer: config.merchantAddress }
      : { name: "USD Coin", version: "2" };
  }

  for (const [pattern, routeConfig] of Object.entries(config.routes)) {
    const chains =
      routeConfig.chains ??
      (routeConfig.chain ? [routeConfig.chain] : ["solana"]);

    const accepts = chains.map((chainShorthand) => {
      const chain = resolveChain(chainShorthand);
      if (!chain) throw new Error(`Unknown chain: ${chainShorthand}`);

      return {
        scheme: "exact" as const,
        network: chain.caip2Id,
        amount: toBaseUnits(routeConfig.price),
        asset: chain.usdcAddress,
        payTo: config.merchantAddress,
        maxTimeoutSeconds: 300,
        extra: defaultExtra(chain.namespace),
      };
    });

    resolvedRoutes.set(pattern, {
      description: routeConfig.description ?? pattern,
      accepts,
    });
  }

  // Once facilitator responds, merge its extra fields into resolved routes
  let facilitatorExtraResolved = false;
  facilitatorExtraPromise.then((extraMap) => {
    if (extraMap.size === 0) return;
    for (const route of resolvedRoutes.values()) {
      for (const accept of route.accepts) {
        const extra = extraMap.get(accept.network);
        if (extra) accept.extra = { ...accept.extra, ...extra };
      }
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

      const paymentRequirements =
        decoded.accepted ?? decoded.paymentRequirements;

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
