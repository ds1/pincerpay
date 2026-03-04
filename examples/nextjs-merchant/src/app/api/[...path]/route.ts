import { Hono } from "hono";
import { handle } from "hono/vercel";
import { pincerpayHono } from "@pincerpay/merchant";

const app = new Hono().basePath("/api");

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    syncFacilitatorOnStart: false,
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
