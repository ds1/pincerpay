import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

// PincerPay middleware — wraps x402 with dead-simple config
app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    facilitatorUrl: process.env.FACILITATOR_URL ?? "http://localhost:4402",
    routes: {
      "GET /api/weather": {
        price: "0.001",
        chain: "base-sepolia",
        description: "Current weather data",
      },
      "GET /api/premium": {
        price: "0.10",
        chains: ["base-sepolia"],
        description: "Premium analytics data",
      },
    },
  }),
);

// Free endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Paywalled endpoints — PincerPay middleware handles 402/settlement
app.get("/api/weather", (_req, res) => {
  res.json({
    temperature: 72,
    conditions: "sunny",
    location: "San Francisco",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/premium", (_req, res) => {
  res.json({
    insights: [
      { metric: "daily_active_agents", value: 1420 },
      { metric: "avg_transaction_value", value: "$0.05" },
      { metric: "settlement_time_p99", value: "1.2s" },
    ],
  });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`Example merchant running at http://localhost:${port}`);
  console.log("Paywalled endpoints:");
  console.log("  GET /api/weather  — 0.001 USDC (Base Sepolia)");
  console.log("  GET /api/premium  — 0.10 USDC (Base Sepolia)");
});
