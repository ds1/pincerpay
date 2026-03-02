import type { DemoEndpoint } from "./types";

export const demoEndpoints: DemoEndpoint[] = [
  {
    method: "GET",
    path: "/api/weather",
    price: "0.001",
    priceNum: 0.001,
    chain: "Solana Devnet",
    description: "Real-time weather data for any city",
    mockResponse: {
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
    },
  },
  {
    method: "GET",
    path: "/api/market-data",
    price: "0.01",
    priceNum: 0.01,
    chain: "Solana Devnet",
    description: "Live crypto market prices and 24h changes",
    mockResponse: {
      timestamp: new Date().toISOString(),
      prices: {
        BTC: { price: 97432.51, change_24h: 2.3 },
        ETH: { price: 3891.22, change_24h: -0.8 },
        SOL: { price: 187.45, change_24h: 5.1 },
        USDC: { price: 1.0, change_24h: 0.0 },
      },
      market_cap_total: "3.42T",
    },
  },
  {
    method: "GET",
    path: "/api/research",
    price: "0.05",
    priceNum: 0.05,
    chain: "Solana Devnet",
    description: "AI-generated research summary with sources",
    mockResponse: {
      topic: "Agent-to-Agent Payments",
      summary:
        "The x402 protocol enables HTTP-native micropayments where AI agents pay for API access using USDC stablecoins. Built on HTTP 402 status codes, it allows merchants to monetize APIs with per-request pricing while agents handle payments autonomously using spending policies.",
      sources: [
        { title: "x402 Protocol Specification", url: "https://github.com/coinbase/x402" },
        { title: "ERC-8004: Trustless Agent Identity", url: "https://eips.ethereum.org/EIPS/eip-8004" },
        { title: "Agent Protocol v2 (AP2)", url: "https://agentprotocol.ai" },
      ],
      confidence: 0.92,
    },
  },
  {
    method: "GET",
    path: "/api/premium-analytics",
    price: "0.10",
    priceNum: 0.1,
    chain: "Solana Devnet",
    description: "Premium analytics dashboard with visitor and revenue data",
    mockResponse: {
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
    },
  },
];
