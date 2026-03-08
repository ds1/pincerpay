import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

const apiKey = process.env.PINCERPAY_API_KEY;
const merchantAddress = process.env.MERCHANT_ADDRESS;
const facilitatorUrl =
  process.env.FACILITATOR_URL || "https://facilitator.pincerpay.com";

// Solana devnet USDC config
const SOLANA_DEVNET_NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const SOLANA_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const routeConfig: Record<
  string,
  { price: string; description: string }
> = {
  "GET /api/weather": { price: "0.001", description: "Real-time weather data" },
  "GET /api/market-data": { price: "0.01", description: "Live crypto market prices" },
  "GET /api/research": { price: "0.05", description: "AI-generated research summary" },
  "GET /api/premium-analytics": { price: "0.10", description: "Premium analytics dashboard" },
};

/** Convert human-readable USDC price (e.g., "0.01") to base units (e.g., "10000") */
function toBaseUnits(price: string): string {
  return String(Math.round(parseFloat(price) * 1_000_000));
}

/**
 * Lightweight x402 paywall middleware for Vercel serverless.
 * Avoids importing @x402/evm and @x402/svm server packages which pull in
 * viem and @solana/kit — incompatible with Vercel's bundler.
 *
 * Flow:
 * 1. No payment header → return 402 with payment requirements
 * 2. Payment header present → forward to facilitator for settlement
 * 3. Settlement succeeds → serve resource
 */
if (apiKey && merchantAddress) {
  app.use("*", async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const routeKey = `${method} ${path}`;
    const config = routeConfig[routeKey];

    // Not a paywalled route
    if (!config) return next();

    // Check for x402 v2 payment signature header
    const paymentHeader = c.req.header("payment-signature") ?? c.req.header("x-payment");

    if (!paymentHeader) {
      // Return 402 Payment Required
      const paymentRequired = {
        x402Version: 2,
        error: "Payment required",
        resource: {
          resource: path,
          description: config.description,
          mimeType: "application/json",
        },
        accepts: [
          {
            scheme: "exact",
            network: SOLANA_DEVNET_NETWORK,
            amount: toBaseUnits(config.price),
            asset: SOLANA_DEVNET_USDC,
            payTo: merchantAddress,
            maxTimeoutSeconds: 300,
            extra: {},
          },
        ],
        extensions: {},
      };

      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
      c.header("payment-required", encoded);
      return c.json(paymentRequired, 402);
    }

    // Payment header present — settle via facilitator
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );

      // Extract the accepted payment requirements from the payload
      const paymentRequirements = decoded.accepted ?? decoded.paymentRequirements;
      const settleRes = await fetch(`${facilitatorUrl}/v1/settle`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pincerpay-api-key": apiKey,
        },
        body: JSON.stringify({
          paymentPayload: decoded,
          paymentRequirements,
        }),
      });

      const settle = await settleRes.json() as {
        success: boolean;
        transaction?: string;
        network?: string;
        errorReason?: string;
        errorMessage?: string;
      };

      if (!settle.success) {
        return c.json(
          { error: "Payment settlement failed", reason: settle.errorReason, message: settle.errorMessage },
          402,
        );
      }

      // Payment succeeded — attach settlement response header and serve resource
      const settleResponse = {
        x402Version: 2,
        success: true,
        transaction: settle.transaction,
        network: settle.network,
      };
      c.header(
        "payment-response",
        Buffer.from(JSON.stringify(settleResponse)).toString("base64"),
      );

      return next();
    } catch (err) {
      console.error("[pincerpay] settlement error:", err);
      return c.json({ error: "Payment processing failed", detail: String(err) }, 500);
    }
  });
}

// --- API routes ---

app.get("/weather", (c) =>
  c.json({
    city: "San Francisco",
    temp: 68,
    feels_like: 65,
    conditions: "Sunny",
    humidity: 52,
    wind: { speed: 12, direction: "NW" },
    forecast: [
      { day: "Tomorrow", high: 71, low: 58, conditions: "Partly Cloudy" },
      { day: "Wednesday", high: 66, low: 55, conditions: "Fog" },
    ],
  }),
);

app.get("/market-data", (c) =>
  c.json({
    timestamp: new Date().toISOString(),
    prices: {
      BTC: { price: 97432.51, change_24h: 2.3 },
      ETH: { price: 3891.22, change_24h: -0.8 },
      SOL: { price: 187.45, change_24h: 5.1 },
      USDC: { price: 1.0, change_24h: 0.0 },
    },
    market_cap_total: "3.42T",
  }),
);

app.get("/research", (c) =>
  c.json({
    topic: "Agent-to-Agent Payments",
    summary:
      "The x402 protocol enables HTTP-native micropayments where AI agents pay for API access using USDC stablecoins.",
    sources: [
      { title: "x402 Protocol Specification", url: "https://github.com/coinbase/x402" },
      { title: "ERC-8004: Trustless Agent Identity", url: "https://eips.ethereum.org/EIPS/eip-8004" },
    ],
    confidence: 0.92,
  }),
);

app.get("/premium-analytics", (c) =>
  c.json({
    period: "Last 30 days",
    visitors: 12847,
    unique_visitors: 8932,
    page_views: 47291,
    revenue: "$4,231.87",
    top_pages: [
      { path: "/pricing", views: 3421 },
      { path: "/docs/quickstart", views: 2918 },
      { path: "/dashboard", views: 2103 },
    ],
    conversion_rate: "3.2%",
    avg_session_duration: "4m 32s",
  }),
);

export const GET = handle(app);
export const POST = handle(app);
