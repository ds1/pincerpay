import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono().basePath("/api");

// Build-safe placeholder: Solana System Program (1...1, 32 bytes of zeros).
// Valid base58 so middleware init passes during `next build` when MERCHANT_ADDRESS
// is unset; never receives funds at runtime — supply a real value via env.
const PLACEHOLDER_SOLANA = "11111111111111111111111111111111";

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY ?? "pp_test_placeholder",
    merchantAddress: process.env.MERCHANT_ADDRESS ?? PLACEHOLDER_SOLANA,
    routes: {
      "GET /api/weather": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Current weather data",
      },
      "GET /api/joke": {
        price: "0.001",
        chain: "solana-devnet",
        description: "Random AI joke",
      },
    },
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/weather", (c) =>
  c.json({
    temperature: 72,
    conditions: "sunny",
    location: "San Francisco",
    timestamp: new Date().toISOString(),
  })
);

app.get("/joke", (c) =>
  c.json({
    setup: "Why did the AI cross the road?",
    punchline: "To get to the other inference.",
  })
);

export const GET = handle(app);
export const POST = handle(app);
