import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { createPincerPayMiddleware } from "../middleware/nextjs.js";
import type { PincerPayContextVariables } from "../middleware/nextjs.js";
import { resolveMerchantAddress } from "@pincerpay/core";

// Reuses the harness pattern from middleware.test.ts. Kept inline rather than
// extracted so each test file is self-contained — when the suite grows enough
// to feel duplicative, hoist into __tests__/helpers/middleware-harness.ts.

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

const SOLANA_WALLET = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";
const POLYGON_WALLET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_WALLET = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";

function supportedHandler(): FetchHandler {
  return (url) => {
    if (url.endsWith("/v1/supported")) {
      return { kinds: [] };
    }
    return new Response("not used in this test", { status: 404 });
  };
}

describe("createPincerPayMiddleware multi-chain wallets", () => {
  let restoreFetch: () => void = () => {};

  afterEach(() => {
    restoreFetch();
  });

  it("legacy single-string merchantAddress still works", async () => {
    restoreFetch = installMockFetch(supportedHandler());

    const app = new Hono<{ Variables: PincerPayContextVariables }>();
    app.use(
      "*",
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddress: SOLANA_WALLET,
        routes: {
          "GET /weather": { price: "0.01", chain: "solana" },
        },
      }),
    );

    const res = await app.request("/weather");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.accepts[0].payTo).toBe(SOLANA_WALLET);
  });

  it("per-chain merchantAddresses sets correct payTo per chain", async () => {
    restoreFetch = installMockFetch(supportedHandler());

    const app = new Hono<{ Variables: PincerPayContextVariables }>();
    app.use(
      "*",
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: {
          solana: SOLANA_WALLET,
          polygon: POLYGON_WALLET,
        },
        routes: {
          "GET /multi": {
            price: "0.05",
            chains: ["solana", "polygon"],
          },
        },
      }),
    );

    const res = await app.request("/multi");
    expect(res.status).toBe(402);
    const body = await res.json();

    const solanaAccept = body.accepts.find((a: { network: string }) =>
      a.network.startsWith("solana:"),
    );
    const polygonAccept = body.accepts.find(
      (a: { network: string }) => a.network === "eip155:137",
    );
    expect(solanaAccept.payTo).toBe(SOLANA_WALLET);
    expect(polygonAccept.payTo).toBe(POLYGON_WALLET);
  });

  it("falls back to legacy merchantAddress when chain not in map", async () => {
    restoreFetch = installMockFetch(supportedHandler());

    const app = new Hono<{ Variables: PincerPayContextVariables }>();
    app.use(
      "*",
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddress: SOLANA_WALLET, // legacy fallback for solana
        merchantAddresses: { polygon: POLYGON_WALLET },
        routes: {
          "GET /mixed": {
            price: "0.05",
            chains: ["solana", "polygon"],
          },
        },
      }),
    );

    const res = await app.request("/mixed");
    const body = await res.json();
    const solanaAccept = body.accepts.find((a: { network: string }) =>
      a.network.startsWith("solana:"),
    );
    const polygonAccept = body.accepts.find(
      (a: { network: string }) => a.network === "eip155:137",
    );
    expect(solanaAccept.payTo).toBe(SOLANA_WALLET);
    expect(polygonAccept.payTo).toBe(POLYGON_WALLET);
  });

  it("matches map keys case-insensitively", async () => {
    restoreFetch = installMockFetch(supportedHandler());

    const app = new Hono<{ Variables: PincerPayContextVariables }>();
    app.use(
      "*",
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: { Solana: SOLANA_WALLET, POLYGON: POLYGON_WALLET },
        routes: { "GET /x": { price: "0.01", chains: ["solana", "polygon"] } },
      }),
    );

    const res = await app.request("/x");
    const body = await res.json();
    expect(body.accepts.find((a: { network: string }) => a.network.startsWith("solana:")).payTo).toBe(SOLANA_WALLET);
    expect(body.accepts.find((a: { network: string }) => a.network === "eip155:137").payTo).toBe(POLYGON_WALLET);
  });

  it("throws at init when neither merchantAddress nor matching merchantAddresses entry is set", () => {
    expect(() =>
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: { solana: SOLANA_WALLET },
        routes: { "POST /trade": { price: "0.05", chain: "polygon" } },
      }),
    ).toThrow(/Route "POST \/trade" targets chain "polygon"/);
  });

  it("throws at init with chain-named error when address format mismatches chain", () => {
    expect(() =>
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: {
          // EVM address mistakenly placed under Solana key
          solana: POLYGON_WALLET,
        },
        routes: { "GET /weather": { price: "0.01", chain: "solana" } },
      }),
    ).toThrow(/chain "solana".*not a valid Solana address/);
  });

  it("throws at init when EVM address pattern is invalid", () => {
    expect(() =>
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: { polygon: "0xnotahexvalue" },
        routes: { "POST /trade": { price: "0.05", chain: "polygon" } },
      }),
    ).toThrow(/chain "polygon".*not a valid EVM address/);
  });

  it("Solana route's feePayer extra defaults to the resolved per-chain address", async () => {
    restoreFetch = installMockFetch(supportedHandler());

    const app = new Hono<{ Variables: PincerPayContextVariables }>();
    app.use(
      "*",
      createPincerPayMiddleware({
        apiKey: "pp_test_x",
        merchantAddresses: { solana: SOLANA_WALLET, polygon: POLYGON_WALLET },
        routes: { "GET /sol": { price: "0.01", chain: "solana" } },
      }),
    );

    const res = await app.request("/sol");
    const body = await res.json();
    expect(body.accepts[0].extra.feePayer).toBe(SOLANA_WALLET);
  });

  describe("resolveMerchantAddress helper", () => {
    it("returns per-chain entry when present", () => {
      expect(
        resolveMerchantAddress(
          {
            merchantAddress: SOLANA_WALLET,
            merchantAddresses: { polygon: POLYGON_WALLET, base: BASE_WALLET },
          },
          "polygon",
        ),
      ).toBe(POLYGON_WALLET);
    });

    it("falls back to legacy merchantAddress when chain not in map", () => {
      expect(
        resolveMerchantAddress(
          {
            merchantAddress: SOLANA_WALLET,
            merchantAddresses: { polygon: POLYGON_WALLET },
          },
          "solana",
        ),
      ).toBe(SOLANA_WALLET);
    });

    it("returns undefined when no source provides an address", () => {
      expect(
        resolveMerchantAddress(
          { merchantAddresses: { polygon: POLYGON_WALLET } },
          "solana",
        ),
      ).toBeUndefined();
    });
  });
});
