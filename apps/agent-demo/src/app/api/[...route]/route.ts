import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

const apiKey = process.env.PINCERPAY_API_KEY;
const merchantAddress = process.env.MERCHANT_ADDRESS;
const facilitatorUrl =
  process.env.FACILITATOR_URL || "https://facilitator.pincerpay.com";

const routes = {
  "GET /api/weather": {
    price: "0.001",
    chain: "solana-devnet",
    description: "Real-time weather data",
  },
  "GET /api/market-data": {
    price: "0.01",
    chain: "solana-devnet",
    description: "Live crypto market prices",
  },
  "GET /api/research": {
    price: "0.05",
    chain: "solana-devnet",
    description: "AI-generated research summary",
  },
  "GET /api/premium-analytics": {
    price: "0.10",
    chain: "solana-devnet",
    description: "Premium analytics dashboard",
  },
} as const;

// Lazy middleware initialization — avoids top-level await issues on Vercel.
// The middleware is loaded on first request and cached for subsequent requests.
let middlewareApplied = false;
if (apiKey && merchantAddress) {
  app.use("*", async (c, next) => {
    if (!middlewareApplied) {
      try {
        const { pincerpayHono } = await import("@pincerpay/merchant/hono");
        const mw = pincerpayHono({
          apiKey,
          merchantAddress,
          facilitatorUrl,
          routes,
          syncFacilitatorOnStart: false,
        });
        app.use(
          "*",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hono patch version mismatch
          mw as any,
        );
        middlewareApplied = true;
        // Re-dispatch this request through the newly added middleware
        return (mw as any)(c, next);
      } catch (err) {
        console.error("[pincerpay] middleware init failed:", err);
        return c.json(
          { error: "Payment middleware initialization failed", detail: String(err) },
          500,
        );
      }
    }
    return next();
  });
}

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
      {
        title: "x402 Protocol Specification",
        url: "https://github.com/coinbase/x402",
      },
      {
        title: "ERC-8004: Trustless Agent Identity",
        url: "https://eips.ethereum.org/EIPS/eip-8004",
      },
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
