/**
 * Example merchant using Next.js + Hono catch-all route.
 *
 * For a standalone Node.js server, see this equivalent pattern
 * using @hono/node-server instead of Vercel's handler.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();

// PincerPay middleware — wraps x402 with dead-simple config
app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    facilitatorUrl: process.env.FACILITATOR_URL ?? "http://localhost:4402",
    routes: {
      "GET /api/weather": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Current weather data",
      },
      "GET /api/premium": {
        price: "0.10",
        chains: ["solana-devnet"],
        description: "Premium analytics data",
      },
    },
  }),
);

// Free endpoint
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Paywalled endpoints — PincerPay middleware handles 402/settlement
app.get("/api/weather", (c) =>
  c.json({
    temperature: 72,
    conditions: "sunny",
    location: "San Francisco",
    timestamp: new Date().toISOString(),
  }),
);

app.get("/api/premium", (c) =>
  c.json({
    insights: [
      { metric: "daily_active_agents", value: 1420 },
      { metric: "avg_transaction_value", value: "$0.05" },
      { metric: "settlement_time_p99", value: "1.2s" },
    ],
  }),
);

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Example merchant running at http://localhost:${port}`);
  console.log("Paywalled endpoints:");
  console.log("  GET /api/weather  — 0.001 USDC (Solana Devnet)");
  console.log("  GET /api/premium  — 0.10 USDC (Solana Devnet)");
});
