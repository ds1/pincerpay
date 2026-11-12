/**
 * Server-side quote builders for merchants that sell something other than an
 * HTTP route (a credit grant, a job, a download link).
 *
 * This module has no hono or `@x402/*` imports. The types are structural
 * copies of `@x402/core` 2.6, so a value built here is accepted anywhere the
 * x402 types are expected.
 */
import type { PincerPayConfig, RoutePaywallConfig } from "@pincerpay/core";
import {
  resolveChain,
  resolveMerchantAddress,
  validateMerchantAddressForChain,
} from "@pincerpay/core";

// ─── Structural x402 2.6 types ───

/** CAIP-2 network id, for example `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`. */
export type Network = `${string}:${string}`;

/** One payment option a merchant offers. Mirrors `@x402/core` `PaymentRequirements`. */
export interface PaymentRequirements {
  scheme: string;
  network: Network;
  /** USDC mint (Solana) or contract (EVM) */
  asset: string;
  /** Amount in USDC base units (6 decimals) */
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}

/** What the merchant is selling. Mirrors `@x402/core` `ResourceInfo`. */
export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

/** The 402 challenge body. Mirrors `@x402/core` `PaymentRequired`. */
export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

/** One scheme and network the facilitator settles. Mirrors `@x402/core` `SupportedKind`. */
export interface SupportedKind {
  x402Version: number;
  scheme: string;
  network: Network;
  extra?: Record<string, unknown>;
}

/** The facilitator's `GET /v1/supported` body. Mirrors `@x402/core` `SupportedResponse`. */
export interface SupportedResponse {
  kinds: SupportedKind[];
  extensions: string[];
  signers: Record<string, string[]>;
}

/** The facilitator's `POST /v1/verify` body. Mirrors `@x402/core` `VerifyResponse`. */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  extensions?: Record<string, unknown>;
}

/** The facilitator's `POST /v1/settle` body. Mirrors `@x402/core` `SettleResponse`. */
export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;
  network: Network;
  extensions?: Record<string, unknown>;
}

/** The facilitator's `GET /v1/status/:txHash` body. */
export interface TransactionStatus {
  id: string;
  /** CAIP-2 network id */
  chainId: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  /** Amount in USDC base units */
  amount: string;
  /** Network fee in base units of the gas token */
  gasCost: string;
  /** pending | mempool | optimistic | confirmed | failed */
  status: string;
  optimistic: boolean;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp, or null until the transaction confirms */
  confirmedAt: string | null;
}

// ─── Errors ───

export interface PincerPayErrorInit {
  /** HTTP status from the facilitator. 0 means no response: a timeout, a network failure, or a local validation error. */
  status: number;
  /** Machine-readable reason, for example `pay_to_not_merchant_wallet`, `timeout`, or `missing_fee_payer`. */
  code?: string;
  /** Parsed JSON body, raw text body, or undefined when there was no response. */
  body?: unknown;
  /** Facilitator path, for example `/v1/settle`. Empty for local validation errors. */
  path?: string;
  /** Seconds from the `Retry-After` header, when the facilitator sent one. */
  retryAfter?: number;
  cause?: unknown;
}

/**
 * The one error type `@pincerpay/merchant` throws for facilitator failures and
 * for quote-builder validation. Branch on `code`.
 */
export class PincerPayError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body: unknown;
  readonly path: string;
  readonly retryAfter?: number;

  constructor(message: string, init: PincerPayErrorInit) {
    super(message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "PincerPayError";
    this.status = init.status;
    this.code = init.code;
    this.body = init.body;
    this.path = init.path ?? "";
    this.retryAfter = init.retryAfter;
  }
}

function invalid(code: string, message: string): PincerPayError {
  return new PincerPayError(`[pincerpay] ${message}`, { status: 0, code });
}

// ─── Amounts ───

/**
 * Convert USDC human-readable amount to base units (6 decimals).
 * "0.01" → "10000"
 */
export function toBaseUnits(amount: string): string {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(6, "0").slice(0, 6);
  const result = BigInt(whole) * BigInt(1_000_000) + BigInt(frac);
  return result.toString();
}

const BPS_DENOMINATOR = 10_000n;

/** `ceil(base * (10000 + feeBps) / 10000)` in base units. */
function grossUp(baseUnits: string, feeBps: number): string {
  if (feeBps === 0) return baseUnits;
  const numerator = BigInt(baseUnits) * (BPS_DENOMINATOR + BigInt(feeBps));
  return ((numerator + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR).toString();
}

/**
 * Return a valid cut in basis points, 0 when unset.
 *
 * @internal
 */
export function validateFeeBps(feeBps: number | undefined): number {
  if (feeBps === undefined) return 0;
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw invalid(
      "invalid_fee_bps",
      `feeBps must be an integer from 0 to 10000, got ${JSON.stringify(feeBps)}.`,
    );
  }
  return feeBps;
}

// ─── Extra fields ───

/**
 * Index the facilitator's `/v1/supported` kinds by network. A later kind for
 * the same network wins. Kinds without `extra` are skipped.
 */
export function supportedExtraByNetwork(
  supported: Pick<SupportedResponse, "kinds"> | undefined,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const kind of supported?.kinds ?? []) {
    if (kind.extra) map.set(kind.network, kind.extra);
  }
  return map;
}

/**
 * Namespace defaults for `extra`. Solana gets a `feePayer` placeholder equal
 * to `payTo` only on the middleware's unchecked path; the facilitator's real
 * fee payer replaces it once `/v1/supported` lands.
 */
function defaultExtra(
  namespace: string,
  payTo: string,
  feePayerFallback: boolean,
): Record<string, unknown> {
  if (namespace === "solana") return feePayerFallback ? { feePayer: payTo } : {};
  return { name: "USD Coin", version: "2" };
}

/** Record the cut on the requirement so an agent can show it. Only a nonzero cut is recorded. */
function withFee(extra: Record<string, unknown>, feeBps: number): Record<string, unknown> {
  return feeBps > 0 ? { ...extra, feeBps } : extra;
}

// ─── Public builders ───

interface BuildPaymentRequirementsBase {
  /**
   * Chain shorthand (`"solana-devnet"`, `"solana"`, `"polygon"`, ...) or CAIP-2
   * id. Required: there is no mainnet default.
   */
  chain: string;
  /** Receiving wallet. Must be the merchant's registered wallet, or the facilitator returns 403 `pay_to_not_merchant_wallet`. */
  payTo: string;
  /** The facilitator's `GET /v1/supported` body. Required on Solana for the facilitator's `feePayer`. */
  supported?: Pick<SupportedResponse, "kinds">;
  /** Extra fields merged over the namespace defaults. The facilitator's kind extra wins over these. */
  extra?: Record<string, unknown>;
  /** Seconds the agent has to submit the payment. Default 300. */
  maxTimeoutSeconds?: number;
  /**
   * PincerPay's cut in basis points, added on top of the listed price:
   * `amount = ceil(base * (10000 + feeBps) / 10000)`. A nonzero cut is also
   * written to `extra.feeBps`.
   */
  feeBps?: number;
}

/** Arguments for {@link buildPaymentRequirements}. Pass exactly one of `price` or `amount`. */
export type BuildPaymentRequirementsOptions = BuildPaymentRequirementsBase &
  (
    | {
        /** Listed price in USDC, for example `"20"` or `"0.01"`. At most 6 decimals. */
        price: string;
        amount?: never;
      }
    | {
        /** Listed price in USDC base units, for example `"20000000"`. */
        amount: string;
        price?: never;
      }
  );

const PRICE_PATTERN = /^\d+(\.\d{1,6})?$/;
const BASE_UNITS_PATTERN = /^\d+$/;

/**
 * Build one `exact` payment requirement for a server-side quote.
 *
 * Store the result with your quote and settle against that stored copy. Never
 * settle against the requirement an agent sends back.
 *
 * Throws {@link PincerPayError} with status 0 and one of these codes:
 * `unknown_chain`, `invalid_pay_to`, `invalid_price`, `invalid_amount`,
 * `invalid_fee_bps`, `invalid_max_timeout`, `missing_fee_payer`.
 */
export function buildPaymentRequirements(
  options: BuildPaymentRequirementsOptions,
): PaymentRequirements {
  const chain = resolveChain(options.chain);
  if (!chain) {
    throw invalid("unknown_chain", `Unknown chain: ${JSON.stringify(options.chain)}.`);
  }

  const payToError =
    typeof options.payTo === "string" && options.payTo.length > 0
      ? validateMerchantAddressForChain(options.payTo, chain.shorthand)
      : "payTo is required.";
  if (payToError) {
    throw invalid("invalid_pay_to", `payTo for ${chain.shorthand}: ${payToError}`);
  }

  const hasPrice = options.price !== undefined;
  const hasAmount = options.amount !== undefined;
  if (hasPrice === hasAmount) {
    throw invalid("invalid_price", "Pass exactly one of price or amount.");
  }

  let baseUnits: string;
  if (hasPrice) {
    if (typeof options.price !== "string" || !PRICE_PATTERN.test(options.price)) {
      throw invalid(
        "invalid_price",
        `price must be a USDC decimal string with at most 6 decimals, got ${JSON.stringify(options.price)}.`,
      );
    }
    baseUnits = toBaseUnits(options.price);
  } else {
    if (typeof options.amount !== "string" || !BASE_UNITS_PATTERN.test(options.amount)) {
      throw invalid(
        "invalid_amount",
        `amount must be a string of USDC base units, got ${JSON.stringify(options.amount)}.`,
      );
    }
    baseUnits = BigInt(options.amount).toString();
  }
  if (baseUnits === "0") {
    throw invalid("invalid_amount", "The price must be greater than zero.");
  }

  const maxTimeoutSeconds = options.maxTimeoutSeconds ?? 300;
  if (!Number.isInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0) {
    throw invalid(
      "invalid_max_timeout",
      `maxTimeoutSeconds must be a positive integer, got ${JSON.stringify(options.maxTimeoutSeconds)}.`,
    );
  }

  const feeBps = validateFeeBps(options.feeBps);
  const facilitatorExtra = supportedExtraByNetwork(options.supported).get(chain.caip2Id) ?? {};
  const extra = withFee(
    {
      ...defaultExtra(chain.namespace, options.payTo, false),
      ...options.extra,
      ...facilitatorExtra,
    },
    feeBps,
  );

  if (chain.namespace === "solana") {
    const feePayer = facilitatorExtra.feePayer;
    if (typeof feePayer !== "string" || feePayer.length === 0) {
      throw invalid(
        "missing_fee_payer",
        `The facilitator's /v1/supported response has no feePayer for ${chain.caip2Id}. Fetch it with PincerPayClient.getSupported() and pass it as supported.`,
      );
    }
  }

  return {
    scheme: "exact",
    network: chain.caip2Id as Network,
    amount: grossUp(baseUnits, feeBps),
    asset: chain.usdcAddress,
    payTo: options.payTo,
    maxTimeoutSeconds,
    extra,
  };
}

/** Arguments for {@link buildPaymentRequired}. */
export interface BuildPaymentRequiredOptions {
  accepts: PaymentRequirements[];
  resource: ResourceInfo;
  error?: string;
  extensions?: Record<string, unknown>;
}

/**
 * Wrap one or more requirements in an x402 version 2 challenge body. A nonzero
 * cut rides along in each requirement's `extra.feeBps`.
 *
 * Throws {@link PincerPayError} `invalid_accepts` when `accepts` is empty and
 * `invalid_resource` when `resource.url` is empty.
 */
export function buildPaymentRequired(options: BuildPaymentRequiredOptions): PaymentRequired {
  if (!Array.isArray(options.accepts) || options.accepts.length === 0) {
    throw invalid("invalid_accepts", "accepts must hold at least one payment requirement.");
  }
  if (typeof options.resource?.url !== "string" || options.resource.url.length === 0) {
    throw invalid("invalid_resource", "resource.url is required.");
  }

  const paymentRequired: PaymentRequired = {
    x402Version: 2,
    resource: { ...options.resource },
    accepts: options.accepts,
  };
  if (options.error !== undefined) paymentRequired.error = options.error;
  if (options.extensions !== undefined) paymentRequired.extensions = options.extensions;
  return paymentRequired;
}

type OfferedRequirement = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
};

/**
 * Return the offered requirement that matches the agent's accepted
 * requirement on scheme, network, amount, asset, and payTo, or undefined.
 * EVM addresses compare case-insensitively. Solana addresses compare exactly.
 *
 * Settle against the returned offer, never against what the agent sent.
 */
export function matchOfferedRequirement<T extends OfferedRequirement>(
  offered: T[],
  accepted: unknown,
): T | undefined {
  if (!accepted || typeof accepted !== "object") return undefined;
  const a = accepted as Record<string, unknown>;

  return offered.find((o) => {
    const sameAddress = (x: string, y: unknown) =>
      typeof y === "string" &&
      (o.network.startsWith("eip155:") ? x.toLowerCase() === y.toLowerCase() : x === y);

    return (
      a.scheme === o.scheme &&
      a.network === o.network &&
      String(a.amount) === o.amount &&
      sameAddress(o.asset, a.asset) &&
      sameAddress(o.payTo, a.payTo)
    );
  });
}

// ─── Middleware internals (not exported from the package root) ───

/**
 * The middleware's route accepts builder. Unchecked: on Solana it falls back
 * to `feePayer: payTo` until `/v1/supported` lands, which keeps the published
 * middleware behavior byte for byte. Server-side quotes use
 * {@link buildPaymentRequirements}, which refuses that fallback.
 *
 * @internal
 */
export function buildRouteAcceptsUnchecked(
  pattern: string,
  routeConfig: RoutePaywallConfig,
  config: Pick<PincerPayConfig, "merchantAddress" | "merchantAddresses">,
  feeBps: number,
): PaymentRequirements[] {
  const chains = routeConfig.chains ?? (routeConfig.chain ? [routeConfig.chain] : ["solana"]);

  return chains.map((chainShorthand) => {
    const chain = resolveChain(chainShorthand);
    if (!chain) throw new Error(`Unknown chain: ${chainShorthand}`);

    const payTo = resolveMerchantAddress(config, chainShorthand);
    if (!payTo) {
      throw new Error(
        `[pincerpay] Route ${JSON.stringify(pattern)} targets chain ${JSON.stringify(chainShorthand)} but no receiving wallet was found. Set merchantAddresses.${chainShorthand} or a legacy merchantAddress.`,
      );
    }

    const formatError = validateMerchantAddressForChain(payTo, chainShorthand);
    if (formatError) {
      throw new Error(
        `[pincerpay] Route ${JSON.stringify(pattern)} targets chain ${JSON.stringify(chainShorthand)}: ${formatError}`,
      );
    }

    return {
      scheme: "exact",
      network: chain.caip2Id as Network,
      amount: grossUp(toBaseUnits(routeConfig.price), feeBps),
      asset: chain.usdcAddress,
      payTo,
      maxTimeoutSeconds: 300,
      extra: withFee(defaultExtra(chain.namespace, payTo, true), feeBps),
    };
  });
}

/**
 * Merge the facilitator's kind extra into requirements built before
 * `/v1/supported` answered. The facilitator's fields win. The cut stays.
 *
 * @internal
 */
export function mergeSupportedExtra(
  accepts: PaymentRequirements[],
  extraByNetwork: Map<string, Record<string, unknown>>,
  feeBps: number,
): void {
  for (const accept of accepts) {
    const extra = extraByNetwork.get(accept.network);
    if (extra) accept.extra = withFee({ ...accept.extra, ...extra }, feeBps);
  }
}
