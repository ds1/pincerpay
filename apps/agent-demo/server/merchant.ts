/**
 * Live mode merchant server.
 * Uses @pincerpay/merchant middleware with Express.
 * Run with: tsx server/merchant.ts
 */

import express from "express";

const app = express();
const PORT = 3001;

async function main() {
  try {
    const { pincerpay } = await import("@pincerpay/merchant");

    const pay = pincerpay({
      facilitatorUrl: process.env.FACILITATOR_URL || "http://localhost:4402",
      payTo: process.env.MERCHANT_ADDRESS!,
      chain: "solana",
      network: "devnet",
    });

    app.get("/api/weather", pay("0.001"), (_req, res) => {
      res.json({
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
      });
    });

    app.get("/api/market-data", pay("0.01"), (_req, res) => {
      res.json({
        timestamp: new Date().toISOString(),
        prices: {
          BTC: { price: 97432.51, change_24h: 2.3 },
          ETH: { price: 3891.22, change_24h: -0.8 },
          SOL: { price: 187.45, change_24h: 5.1 },
          USDC: { price: 1.0, change_24h: 0.0 },
        },
        market_cap_total: "3.42T",
      });
    });

    app.get("/api/research", pay("0.05"), (_req, res) => {
      res.json({
        topic: "Agent-to-Agent Payments",
        summary:
          "The x402 protocol enables HTTP-native micropayments where AI agents pay for API access using USDC stablecoins.",
        sources: [
          { title: "x402 Protocol Specification", url: "https://github.com/coinbase/x402" },
          { title: "ERC-8004: Trustless Agent Identity", url: "https://eips.ethereum.org/EIPS/eip-8004" },
        ],
        confidence: 0.92,
      });
    });

    app.get("/api/premium-analytics", pay("0.10"), (_req, res) => {
      res.json({
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
      });
    });

    console.log(`Merchant middleware loaded — endpoints protected with x402 payments`);
  } catch {
    console.log("@pincerpay/merchant not available — running without payment middleware");
    console.log("Install optional dependencies for live mode: npm install");

    app.get("/api/weather", (_req, res) => {
      res.json({ error: "Live mode requires @pincerpay/merchant. Run npm install in the demo directory." });
    });

    app.get("/api/market-data", (_req, res) => {
      res.json({ error: "Live mode requires @pincerpay/merchant" });
    });

    app.get("/api/research", (_req, res) => {
      res.json({ error: "Live mode requires @pincerpay/merchant" });
    });

    app.get("/api/premium-analytics", (_req, res) => {
      res.json({ error: "Live mode requires @pincerpay/merchant" });
    });
  }

  app.listen(PORT, () => {
    console.log(`Merchant server running on http://localhost:${PORT}`);
  });
}

main();
