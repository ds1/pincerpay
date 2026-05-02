/**
 * Research Data Merchant Server
 * 
 * This is a mock merchant API that provides research data services.
 * AI agents can pay with USDC to access premium research data.
 * 
 * Run: pnpm start
 * 
 * The agent will automatically handle 402 payment challenges.
 */

import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant/hono";

const app = new Hono();

// PincerPay middleware - configures paid endpoints
// Agents hitting these endpoints will receive HTTP 402 and need to pay
app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    routes: {
      // Research data endpoints - priced in USDC
      "GET /api/research/summaries": {
        price: "0.05", // 5 cents per summary
        chain: "solana-devnet",
        description: "AI-generated research summaries",
      },
      "GET /api/research/trends": {
        price: "0.10", // 10 cents for trend analysis
        chain: "solana-devnet",
        description: "Market and technology trends",
      },
      "GET /api/research/competitors": {
        price: "0.25", // 25 cents for competitor analysis
        chains: ["solana-devnet", "base-sepolia"],
        description: "Competitor intelligence reports",
      },
      "POST /api/research/analyze": {
        price: "0.50", // 50 cents for deep analysis
        chain: "solana-devnet",
        description: "Deep analysis of provided content",
      },
    },
  })
);

// Free endpoint - no payment required
app.get("/api/research/topics", (c) => {
  return c.json({
    topics: ["AI", "blockchain", "web3", "defi", "nft"],
  });
});

// Paid endpoints
app.get("/api/research/summaries", (c) => {
  const topic = c.req.query("topic") || "general";
  return c.json({
    topic,
    summaries: [
      {
        id: "1",
        title: `${topic}: Current State of Development`,
        excerpt: "Recent developments in the space show increased adoption...",
        date: "2024-01-15",
      },
      {
        id: "2", 
        title: `${topic}: Investment Trends`,
        excerpt: "VC funding has increased by 40% quarter over quarter...",
        date: "2024-01-10",
      },
    ],
  });
});

app.get("/api/research/trends", (c) => {
  const industry = c.req.query("industry") || "tech";
  return c.json({
    industry,
    trends: [
      {
        trend: "AI Integration",
        growth: "+45%",
        sentiment: "positive",
      },
      {
        trend: "Decentralized Infrastructure",
        growth: "+32%",
        sentiment: "positive",
      },
    ],
  });
});

app.get("/api/research/competitors", (c) => {
  const sector = c.req.query("sector") || "ai";
  return c.json({
    sector,
    competitors: [
      {
        name: "Competitor A",
        marketShare: "23%",
        strengths: ["Scale", "Brand recognition"],
      },
      {
        name: "Competitor B", 
        marketShare: "18%",
        strengths: ["Innovation", "Developer ecosystem"],
      },
    ],
  });
});

app.post("/api/research/analyze", async (c) => {
  const body = await c.req.json();
  const { content, analysisType } = body;
  
  return c.json({
    content: content.substring(0, 100) + "...",
    analysisType,
    results: {
      sentiment: "positive",
      keyThemes: ["innovation", "growth", "disruption"],
      recommendations: [
        "Consider strategic partnerships",
        "Focus on developer experience",
      ],
    },
  });
});

const port = parseInt(process.env.PORT || "3001");

console.log(`Research API server running on http://localhost:${port}`);
console.log("Available endpoints:");
console.log("  GET  /api/research/topics     - Free");
console.log("  GET  /api/research/summaries  - 0.05 USDC (solana-devnet)");
console.log("  GET  /api/research/trends     - 0.10 USDC (solana-devnet)");
console.log("  GET  /api/research/competitors - 0.25 USDC (solana-devnet, base-sepolia)");
console.log("  POST /api/research/analyze    - 0.50 USDC (solana-devnet)");

export default {
  port,
  fetch: app.fetch,
};
