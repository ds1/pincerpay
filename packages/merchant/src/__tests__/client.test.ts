import { describe, it, expect, afterEach } from "vitest";
import { toBaseUnits, resolveRouteChains, getUsdcAsset, PincerPayClient } from "../client.js";
import { PincerPayError } from "../requirements.js";
import { typecheckSnippet } from "./typecheck.js";

describe("toBaseUnits", () => {
  it("converts whole numbers", () => {
    expect(toBaseUnits("1")).toBe("1000000");
    expect(toBaseUnits("100")).toBe("100000000");
  });

  it("converts decimal amounts", () => {
    expect(toBaseUnits("0.01")).toBe("10000");
    expect(toBaseUnits("0.001")).toBe("1000");
    expect(toBaseUnits("1.50")).toBe("1500000");
    expect(toBaseUnits("0.000001")).toBe("1");
  });

  it("truncates beyond 6 decimals", () => {
    expect(toBaseUnits("0.0000001")).toBe("0");
    expect(toBaseUnits("1.1234567")).toBe("1123456");
  });

  it("handles zero", () => {
    expect(toBaseUnits("0")).toBe("0");
    expect(toBaseUnits("0.00")).toBe("0");
  });

  it("handles large amounts", () => {
    expect(toBaseUnits("1000000")).toBe("1000000000000");
  });
});

describe("resolveRouteChains", () => {
  it("resolves single chain shorthand", () => {
    const result = resolveRouteChains({ price: "0.01", chain: "base" });
    expect(result).toEqual(["eip155:8453"]);
  });

  it("resolves multiple chain shorthands", () => {
    const result = resolveRouteChains({
      price: "0.01",
      chains: ["base", "polygon"],
    });
    expect(result).toEqual(["eip155:8453", "eip155:137"]);
  });

  it("defaults to solana when no chain specified", () => {
    const result = resolveRouteChains({ price: "0.01" });
    expect(result).toEqual(["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"]);
  });

  it("prefers chains array over chain string", () => {
    const result = resolveRouteChains({
      price: "0.01",
      chain: "polygon",
      chains: ["base"],
    });
    expect(result).toEqual(["eip155:8453"]);
  });
});

describe("getUsdcAsset", () => {
  it("returns USDC address for known chains", () => {
    expect(getUsdcAsset("base")).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(getUsdcAsset("polygon")).toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
    expect(getUsdcAsset("solana")).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });

  it("throws for unknown chains", () => {
    expect(() => getUsdcAsset("ethereum")).toThrow("Unknown chain: ethereum");
  });
});

// ─── #178: PincerPayClient for server-side quotes ───

type Call = { url: string; init?: RequestInit };

function installMockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): { calls: Call[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function rejection(promise: Promise<unknown>): Promise<PincerPayError> {
  const err = await promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PincerPayError);
  return err as PincerPayError;
}

describe("PincerPayClient", () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it("throws a typed 403 pay_to_not_merchant_wallet", async () => {
    const body = {
      error: "pay_to_not_merchant_wallet",
      message: "paymentRequirements.payTo must be the merchant's registered wallet.",
    };
    ({ restore } = installMockFetch(() => json(body, 403)));
    const client = new PincerPayClient({ apiKey: "pp_test_x", facilitatorUrl: "https://f.test" });

    const err = await rejection(client.settle({}, {}));
    expect(err.status).toBe(403);
    expect(err.code).toBe("pay_to_not_merchant_wallet");
    expect(err.body).toEqual(body);
    expect(err.path).toBe("/v1/settle");
    expect(err.message).toBe(`Facilitator /v1/settle failed (403): ${JSON.stringify(body)}`);
  });

  it("reads code from errorReason on a settle crash", async () => {
    ({ restore } = installMockFetch(() =>
      json({ success: false, errorReason: "INTERNAL_ERROR", transaction: "", network: "" }, 500),
    ));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).settle({}, {}));
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  it("reads code from invalidReason", async () => {
    ({ restore } = installMockFetch(() => json({ isValid: false, invalidReason: "invalid_payload" }, 400)));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).verify({}, {}));
    expect(err.code).toBe("invalid_payload");
  });

  it("keeps a text body on a 502", async () => {
    ({ restore } = installMockFetch(() => new Response("Bad gateway", { status: 502 })));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).verify({}, {}));
    expect(err.status).toBe(502);
    expect(err.body).toBe("Bad gateway");
    expect(err.code).toBeUndefined();
    expect(err.message).toBe("Facilitator /v1/verify failed (502): Bad gateway");
  });

  it("parses Retry-After on a 429", async () => {
    ({ restore } = installMockFetch(() => json({ error: "Rate limit exceeded" }, 429, { "retry-after": "7" })));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).getSupported());
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(7);
  });

  it("does not throw on a 200 with isValid false", async () => {
    ({ restore } = installMockFetch(() => json({ isValid: false, invalidReason: "insufficient_funds" })));
    const res = await new PincerPayClient({ apiKey: "k" }).verify({}, {});
    expect(res.isValid).toBe(false);
  });

  it("throws a 404 from getStatus", async () => {
    ({ restore } = installMockFetch(() => json({ error: "Transaction not found" }, 404)));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).getStatus("abc"));
    expect(err.status).toBe(404);
    expect(err.path).toBe("/v1/status/abc");
  });

  it("strips a trailing /v1 from the facilitator URL", async () => {
    let calls: Call[];
    ({ calls, restore } = installMockFetch(() => json({ kinds: [], extensions: [], signers: {} })));
    const client = new PincerPayClient({ apiKey: "k", facilitatorUrl: "https://f.test/v1/" });
    expect(client.facilitatorUrl).toBe("https://f.test");
    await client.getSupported();
    expect(calls[0]!.url).toBe("https://f.test/v1/supported");
  });

  it("encodes the transaction hash", async () => {
    let calls: Call[];
    ({ calls, restore } = installMockFetch(() => json({ txHash: "x" })));
    await new PincerPayClient({ apiKey: "k", facilitatorUrl: "https://f.test" }).getStatus("a/b?c#d");
    expect(calls[0]!.url).toBe("https://f.test/v1/status/a%2Fb%3Fc%23d");
  });

  it("sends the API key header", async () => {
    let calls: Call[];
    ({ calls, restore } = installMockFetch(() => json({ isValid: true })));
    await new PincerPayClient({ apiKey: "pp_test_abc" }).verify({}, {});
    expect((calls[0]!.init!.headers as Record<string, string>)["x-pincerpay-api-key"]).toBe("pp_test_abc");
  });

  it("times out with status 0 code timeout", async () => {
    ({ restore } = installMockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    ));
    const client = new PincerPayClient({ apiKey: "k", timeoutMs: 20 });
    expect(client.timeoutMs).toBe(20);
    const err = await rejection(client.settle({}, {}));
    expect(err.status).toBe(0);
    expect(err.code).toBe("timeout");
    expect(err.path).toBe("/v1/settle");
  });

  it("defaults to a 60 second timeout", () => {
    expect(new PincerPayClient({ apiKey: "k" }).timeoutMs).toBe(60_000);
  });

  it("wraps a network failure as status 0 code network_error", async () => {
    ({ restore } = installMockFetch(() => Promise.reject(new TypeError("fetch failed"))));
    const err = await rejection(new PincerPayClient({ apiKey: "k" }).getSupported());
    expect(err.status).toBe(0);
    expect(err.code).toBe("network_error");
  });

  it("compiles without routes, and a full PincerPayConfig still fits", () => {
    const errors = typecheckSnippet(`
      import { PincerPayClient } from "../index.js";
      import type { PincerPayConfig } from "@pincerpay/core";
      const a = new PincerPayClient({ apiKey: "pp_test_x" });
      const full: PincerPayConfig = { apiKey: "pp_test_x", merchantAddress: "m", routes: {} };
      const b = new PincerPayClient(full);
      void a; void b;
    `);
    expect(errors).toEqual([]);
  });

  it("types its responses", () => {
    const errors = typecheckSnippet(`
      import { PincerPayClient } from "../index.js";
      async function run(client: PincerPayClient) {
        const settled: boolean = (await client.settle({}, {})).success;
        const tx: string = (await client.settle({}, {})).transaction;
        const valid: boolean = (await client.verify({}, {})).isValid;
        const kinds: number = (await client.getSupported()).kinds.length;
        const amount: string = (await client.getStatus("t")).amount;
        return [settled, tx, valid, kinds, amount];
      }
      void run;
    `);
    expect(errors).toEqual([]);
  });
});
