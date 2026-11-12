import { describe, it, expect } from "vitest";
import {
  buildPaymentRequirements,
  buildPaymentRequired,
  matchOfferedRequirement,
  PincerPayError,
} from "../index.js";
import type { SupportedResponse } from "../index.js";
import { typecheckSnippet } from "./typecheck.js";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOLANA_MERCHANT = "Qa4Vp4kMKD5P8syNrc1ywz7WHiCt4poyykCKR21zLxP";
const FACILITATOR_FEE_PAYER = "GjsWy1viAxWZkb4VyLVz3oU7sNpvyuKXnRu11uUybNgm";
const EVM_MERCHANT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const SUPPORTED: SupportedResponse = {
  kinds: [
    { x402Version: 2, scheme: "exact", network: SOLANA_DEVNET, extra: { feePayer: FACILITATOR_FEE_PAYER } },
    { x402Version: 2, scheme: "exact", network: "eip155:80002" },
  ],
  extensions: [],
  signers: {},
};

function thrown(fn: () => unknown): PincerPayError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(PincerPayError);
    return err as PincerPayError;
  }
  throw new Error("expected a throw");
}

describe("buildPaymentRequirements", () => {
  it("takes the devnet feePayer from the facilitator's supported kinds", () => {
    const req = buildPaymentRequirements({
      chain: "solana-devnet",
      payTo: SOLANA_MERCHANT,
      price: "20",
      supported: SUPPORTED,
    });

    expect(req).toEqual({
      scheme: "exact",
      network: SOLANA_DEVNET,
      amount: "20000000",
      asset: DEVNET_USDC,
      payTo: SOLANA_MERCHANT,
      maxTimeoutSeconds: 300,
      extra: { feePayer: FACILITATOR_FEE_PAYER },
    });
  });

  it("accepts a CAIP-2 chain id", () => {
    const req = buildPaymentRequirements({
      chain: SOLANA_DEVNET,
      payTo: SOLANA_MERCHANT,
      amount: "1",
      supported: SUPPORTED,
    });
    expect(req.network).toBe(SOLANA_DEVNET);
  });

  it("throws missing_fee_payer on Solana without supported", () => {
    const err = thrown(() =>
      buildPaymentRequirements({ chain: "solana-devnet", payTo: SOLANA_MERCHANT, price: "20" }),
    );
    expect(err.code).toBe("missing_fee_payer");
    expect(err.status).toBe(0);
  });

  it("throws missing_fee_payer when supported lists another network only", () => {
    const err = thrown(() =>
      buildPaymentRequirements({
        chain: "solana-devnet",
        payTo: SOLANA_MERCHANT,
        price: "20",
        supported: {
          kinds: [{ x402Version: 2, scheme: "exact", network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", extra: { feePayer: FACILITATOR_FEE_PAYER } }],
        },
      }),
    );
    expect(err.code).toBe("missing_fee_payer");
  });

  it("never falls back to payTo as the Solana feePayer, even when the caller passes one", () => {
    const err = thrown(() =>
      buildPaymentRequirements({
        chain: "solana-devnet",
        payTo: SOLANA_MERCHANT,
        price: "20",
        extra: { feePayer: SOLANA_MERCHANT },
      }),
    );
    expect(err.code).toBe("missing_fee_payer");
  });

  it("sets the EVM USDC EIP-712 name and version", () => {
    const req = buildPaymentRequirements({ chain: "polygon-amoy", payTo: EVM_MERCHANT, price: "0.01" });
    expect(req.network).toBe("eip155:80002");
    expect(req.amount).toBe("10000");
    expect(req.extra).toEqual({ name: "USD Coin", version: "2" });
  });

  it("merges extra as namespace default, then caller, then facilitator", () => {
    const req = buildPaymentRequirements({
      chain: "polygon-amoy",
      payTo: EVM_MERCHANT,
      price: "1",
      extra: { version: "caller", note: "kept" },
      supported: {
        kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:80002", extra: { note: "facilitator" } }],
      },
    });
    expect(req.extra).toEqual({ name: "USD Coin", version: "caller", note: "facilitator" });
  });

  it("treats price \"20\" and amount \"20000000\" as the same quote", () => {
    const base = { chain: "solana-devnet", payTo: SOLANA_MERCHANT, supported: SUPPORTED } as const;
    expect(buildPaymentRequirements({ ...base, price: "20" })).toEqual(
      buildPaymentRequirements({ ...base, amount: "20000000" }),
    );
  });

  it("honors maxTimeoutSeconds", () => {
    const req = buildPaymentRequirements({
      chain: "polygon-amoy",
      payTo: EVM_MERCHANT,
      price: "1",
      maxTimeoutSeconds: 60,
    });
    expect(req.maxTimeoutSeconds).toBe(60);
  });

  it("throws invalid_pay_to on a malformed payTo", () => {
    const solana = thrown(() =>
      buildPaymentRequirements({ chain: "solana-devnet", payTo: EVM_MERCHANT, price: "1", supported: SUPPORTED }),
    );
    expect(solana.code).toBe("invalid_pay_to");

    const evm = thrown(() =>
      buildPaymentRequirements({ chain: "polygon-amoy", payTo: SOLANA_MERCHANT, price: "1" }),
    );
    expect(evm.code).toBe("invalid_pay_to");
  });

  it("throws unknown_chain on a chain it does not know", () => {
    const err = thrown(() =>
      buildPaymentRequirements({ chain: "ethereum", payTo: EVM_MERCHANT, price: "1" }),
    );
    expect(err.code).toBe("unknown_chain");
  });

  it.each([
    ["more than 6 decimals", { price: "0.0000001" }, "invalid_price"],
    ["a negative price", { price: "-1" }, "invalid_price"],
    ["a zero price", { price: "0" }, "invalid_amount"],
    ["a decimal amount", { amount: "1.5" }, "invalid_amount"],
    ["neither price nor amount", {}, "invalid_price"],
  ])("rejects %s", (_label, money, code) => {
    const err = thrown(() =>
      buildPaymentRequirements({
        chain: "polygon-amoy",
        payTo: EVM_MERCHANT,
        ...(money as { price: string }),
      }),
    );
    expect(err.code).toBe(code);
  });

  describe("feeBps", () => {
    it("grosses the amount up and records the cut in extra", () => {
      const req = buildPaymentRequirements({
        chain: "solana-devnet",
        payTo: SOLANA_MERCHANT,
        price: "20",
        supported: SUPPORTED,
        feeBps: 100,
      });
      expect(req.amount).toBe("20200000");
      expect(req.extra).toEqual({ feePayer: FACILITATOR_FEE_PAYER, feeBps: 100 });
    });

    it("rounds the gross-up up to the next base unit", () => {
      const req = buildPaymentRequirements({
        chain: "polygon-amoy",
        payTo: EVM_MERCHANT,
        amount: "1",
        feeBps: 100,
      });
      // 1 * 10100 / 10000 = 1.01, so the agent pays 2 base units
      expect(req.amount).toBe("2");
    });

    it("leaves the amount and extra alone at 0", () => {
      const req = buildPaymentRequirements({
        chain: "polygon-amoy",
        payTo: EVM_MERCHANT,
        price: "1",
        feeBps: 0,
      });
      expect(req.amount).toBe("1000000");
      expect(req.extra).not.toHaveProperty("feeBps");
    });

    it.each([-1, 1.5, 10_001, Number.NaN])("rejects feeBps %s", (feeBps) => {
      const err = thrown(() =>
        buildPaymentRequirements({ chain: "polygon-amoy", payTo: EVM_MERCHANT, price: "1", feeBps }),
      );
      expect(err.code).toBe("invalid_fee_bps");
    });
  });

  it("refuses to compile without a chain", () => {
    const errors = typecheckSnippet(`
      import { buildPaymentRequirements } from "../index.js";
      buildPaymentRequirements({ payTo: "x", price: "1" });
    `);
    expect(errors.join("\n")).toMatch(/chain/);
  });

  it("refuses to compile with both price and amount", () => {
    const errors = typecheckSnippet(`
      import { buildPaymentRequirements } from "../index.js";
      buildPaymentRequirements({ chain: "solana-devnet", payTo: "x", price: "1", amount: "1000000" });
    `);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("compiles a well-formed call", () => {
    const errors = typecheckSnippet(`
      import { buildPaymentRequirements } from "../index.js";
      import type { PaymentRequirements } from "../index.js";
      const req: PaymentRequirements = buildPaymentRequirements({ chain: "solana-devnet", payTo: "x", price: "1" });
      void req;
    `);
    expect(errors).toEqual([]);
  });
});

describe("buildPaymentRequired", () => {
  const accepts = [
    buildPaymentRequirements({
      chain: "solana-devnet",
      payTo: SOLANA_MERCHANT,
      price: "20",
      supported: SUPPORTED,
      feeBps: 100,
    }),
  ];

  it("emits an x402 version 2 body with resource.url", () => {
    const body = buildPaymentRequired({
      accepts,
      resource: { url: "https://stud.com/credits/pack_500", description: "500 credits" },
    });
    expect(body).toEqual({
      x402Version: 2,
      resource: { url: "https://stud.com/credits/pack_500", description: "500 credits" },
      accepts,
    });
    expect(body.resource).not.toHaveProperty("resource");
  });

  it("carries the cut in extra.feeBps", () => {
    const body = buildPaymentRequired({ accepts, resource: { url: "urn:stud:quote:q1" } });
    expect(body.accepts[0]!.extra.feeBps).toBe(100);
  });

  it("passes error and extensions through", () => {
    const body = buildPaymentRequired({
      accepts,
      resource: { url: "urn:stud:quote:q1" },
      error: "Payment required",
      extensions: { quoteId: "q1" },
    });
    expect(body.error).toBe("Payment required");
    expect(body.extensions).toEqual({ quoteId: "q1" });
  });

  it("rejects an empty accepts list and a missing url", () => {
    expect(thrown(() => buildPaymentRequired({ accepts: [], resource: { url: "u" } })).code).toBe(
      "invalid_accepts",
    );
    expect(thrown(() => buildPaymentRequired({ accepts, resource: { url: "" } })).code).toBe(
      "invalid_resource",
    );
  });
});

describe("matchOfferedRequirement", () => {
  const evmOffer = {
    scheme: "exact",
    network: "eip155:80002",
    amount: "1000000",
    asset: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    payTo: EVM_MERCHANT,
  };
  const solanaOffer = {
    scheme: "exact",
    network: SOLANA_DEVNET,
    amount: "20000000",
    asset: DEVNET_USDC,
    payTo: SOLANA_MERCHANT,
  };

  it("matches EVM addresses case-insensitively", () => {
    const accepted = { ...evmOffer, payTo: EVM_MERCHANT.toLowerCase(), asset: evmOffer.asset.toUpperCase().replace("0X", "0x") };
    expect(matchOfferedRequirement([evmOffer], accepted)).toBe(evmOffer);
  });

  it("matches Solana addresses exactly", () => {
    expect(matchOfferedRequirement([solanaOffer], { ...solanaOffer })).toBe(solanaOffer);
    expect(
      matchOfferedRequirement([solanaOffer], { ...solanaOffer, payTo: SOLANA_MERCHANT.toLowerCase() }),
    ).toBeUndefined();
  });

  it("matches a numeric amount", () => {
    expect(matchOfferedRequirement([solanaOffer], { ...solanaOffer, amount: 20_000_000 })).toBe(solanaOffer);
  });

  it("returns undefined when payTo differs", () => {
    expect(
      matchOfferedRequirement([solanaOffer], { ...solanaOffer, payTo: FACILITATOR_FEE_PAYER }),
    ).toBeUndefined();
  });

  it("returns undefined for a non-object", () => {
    expect(matchOfferedRequirement([solanaOffer], undefined)).toBeUndefined();
    expect(matchOfferedRequirement([solanaOffer], "exact")).toBeUndefined();
  });
});
