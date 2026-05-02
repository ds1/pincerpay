import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { createPincerPayMiddleware } from "../middleware/nextjs.js";
import type { PincerPayContextVariables } from "../middleware/nextjs.js";

// ─── Reusable test harness ───
//
// `installMockFetch` lets a test stub the facilitator. The router receives
// (url, init) and returns either a JSON body or a Response. Future middleware
// tests (S5 webhooks, etc.) can drop in here.

type FetchHandler = (
  url: string,
  init?: RequestInit,
) => Promise<Response> | Response | Record<string, unknown>;

function installMockFetch(handler: FetchHandler): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = await handler(url, init);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const SOLANA_AGENT = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";
const SOLANA_MERCHANT = "Qa4Vp4kMKD5P8syNrc1ywz7WHiCt4poyykCKR21zLxP";

function buildApp(supportedKinds: Array<{ network: string; extra?: Record<string, unknown> }> = []) {
  const middleware = createPincerPayMiddleware({
    apiKey: "pp_test_unit",
    merchantAddress: SOLANA_MERCHANT,
    facilitatorUrl: "https://facilitator.test",
    routes: {
      "GET /weather": {
        price: "0.01",
        chain: "solana",
        description: "Weather data",
      },
    },
  });

  const app = new Hono<{ Variables: PincerPayContextVariables }>();
  app.use("*", middleware);
  app.get("/weather", (c) => {
    const info = c.get("pincerpay");
    return c.json({ temp: 72, paidBy: info?.payer ?? null });
  });

  return { app, supportedKinds };
}

function defaultFacilitatorHandler(
  settleResponse: Record<string, unknown>,
): FetchHandler {
  return (url) => {
    if (url.endsWith("/v1/supported")) {
      return { kinds: [{ network: "solana:devnet" }] };
    }
    if (url.endsWith("/v1/settle")) {
      return settleResponse;
    }
    return new Response("not found", { status: 404 });
  };
}

describe("createPincerPayMiddleware", () => {
  let restoreFetch: () => void = () => {};

  afterEach(() => {
    restoreFetch();
  });

  it("returns 402 when no payment header is present", async () => {
    restoreFetch = installMockFetch(defaultFacilitatorHandler({}));
    const { app } = buildApp();

    const res = await app.request("/weather");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
    expect(body.error).toBe("Payment required");
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0].network).toMatch(/^solana:/);
    expect(body.accepts[0].amount).toBe("10000"); // 0.01 USDC in base units
  });

  it("surfaces verified payer on c.get('pincerpay') after settlement", async () => {
    restoreFetch = installMockFetch(
      defaultFacilitatorHandler({
        success: true,
        transaction: "tx_abc",
        network: "solana:devnet",
        payer: SOLANA_AGENT,
      }),
    );
    const { app } = buildApp();

    const paymentPayload = Buffer.from(
      JSON.stringify({
        x402Version: 2,
        scheme: "exact",
        network: "solana:devnet",
        payload: { signature: "deadbeef" },
      }),
    ).toString("base64");

    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paidBy).toBe(SOLANA_AGENT);
  });

  it("includes payer in the payment-response header", async () => {
    restoreFetch = installMockFetch(
      defaultFacilitatorHandler({
        success: true,
        transaction: "tx_abc",
        network: "solana:devnet",
        payer: SOLANA_AGENT,
      }),
    );
    const { app } = buildApp();

    const paymentPayload = Buffer.from(
      JSON.stringify({ x402Version: 2, scheme: "exact" }),
    ).toString("base64");

    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    const headerB64 = res.headers.get("payment-response");
    expect(headerB64).toBeTruthy();
    const decoded = JSON.parse(
      Buffer.from(headerB64!, "base64").toString("utf-8"),
    );
    expect(decoded.payer).toBe(SOLANA_AGENT);
    expect(decoded.transaction).toBe("tx_abc");
    expect(decoded.network).toBe("solana:devnet");
  });

  it("returns 402 with reason when settlement fails", async () => {
    restoreFetch = installMockFetch(
      defaultFacilitatorHandler({
        success: false,
        errorReason: "INSUFFICIENT_BALANCE",
        errorMessage: "Agent has 0.001 USDC, needs 0.01",
      }),
    );
    const { app } = buildApp();

    const paymentPayload = Buffer.from(
      JSON.stringify({ x402Version: 2, scheme: "exact" }),
    ).toString("base64");

    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Payment settlement failed");
    expect(body.reason).toBe("INSUFFICIENT_BALANCE");
  });

  it("handles missing payer in settle response gracefully", async () => {
    restoreFetch = installMockFetch(
      defaultFacilitatorHandler({
        success: true,
        transaction: "tx_abc",
        network: "solana:devnet",
        // No payer field — older facilitator or non-conforming response
      }),
    );
    const { app } = buildApp();

    const paymentPayload = Buffer.from(
      JSON.stringify({ x402Version: 2, scheme: "exact" }),
    ).toString("base64");

    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paidBy).toBe(""); // empty string fallback, not undefined
  });
});
