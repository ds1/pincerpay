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

// Build a payment header the way a real x402 client does: copy the offered
// requirement from the 402 response into `accepted`, optionally tampered.
async function paymentHeaderFor(
  app: Hono<{ Variables: PincerPayContextVariables }>,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const offer = await (await app.request("/weather")).json();
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      accepted: { ...offer.accepts[0], ...overrides },
      payload: { transaction: "base64tx" },
    }),
  ).toString("base64");
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

    const paymentPayload = await paymentHeaderFor(app);

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

    const paymentPayload = await paymentHeaderFor(app);

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

    const paymentPayload = await paymentHeaderFor(app);

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

    const paymentPayload = await paymentHeaderFor(app);

    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paidBy).toBe(""); // empty string fallback, not undefined
  });

  // ─── GHSA-pwgq-6779-q657: never settle against agent-supplied terms ───

  function recordingFacilitator() {
    const settleBodies: Array<Record<string, unknown>> = [];
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith("/v1/supported")) return { kinds: [] };
      if (url.endsWith("/v1/settle")) {
        settleBodies.push(JSON.parse(String(init?.body)));
        return { success: true, transaction: "tx_abc", network: "solana:x", payer: SOLANA_AGENT };
      }
      return new Response("not found", { status: 404 });
    };
    return { handler, settleBodies };
  }

  it("sends the route's own requirements to the facilitator", async () => {
    const { handler, settleBodies } = recordingFacilitator();
    restoreFetch = installMockFetch(handler);
    const { app } = buildApp();

    const offer = (await (await app.request("/weather")).json()).accepts[0];
    const res = await app.request("/weather", {
      headers: { "x-payment": await paymentHeaderFor(app) },
    });

    expect(res.status).toBe(200);
    expect(settleBodies).toHaveLength(1);
    expect(settleBodies[0]!.paymentRequirements).toEqual(offer);
  });

  it.each([
    ["underpays", { amount: "1" }],
    ["pays itself", { payTo: SOLANA_AGENT }],
    ["swaps the asset", { asset: "So11111111111111111111111111111111111111112" }],
    ["switches network", { network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" }],
    ["changes scheme", { scheme: "upto" }],
  ])("rejects a payment that %s without calling settle", async (_label, overrides) => {
    const { handler, settleBodies } = recordingFacilitator();
    restoreFetch = installMockFetch(handler);
    const { app } = buildApp();

    const res = await app.request("/weather", {
      headers: { "x-payment": await paymentHeaderFor(app, overrides) },
    });

    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("payment_requirements_mismatch");
    expect(settleBodies).toHaveLength(0);
  });

  it("rejects a payment header with no accepted requirements", async () => {
    const { handler, settleBodies } = recordingFacilitator();
    restoreFetch = installMockFetch(handler);
    const { app } = buildApp();

    const paymentPayload = Buffer.from(
      JSON.stringify({ x402Version: 2, scheme: "exact", payload: {} }),
    ).toString("base64");
    const res = await app.request("/weather", {
      headers: { "x-payment": paymentPayload },
    });

    expect(res.status).toBe(402);
    expect(settleBodies).toHaveLength(0);
  });
});
