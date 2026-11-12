import {
  DEFAULT_FACILITATOR_URL,
  FACILITATOR_ROUTES,
  API_KEY_HEADER,
} from "@pincerpay/core";
import type { RoutePaywallConfig } from "@pincerpay/core";
import { resolveChain, toCAIP2 } from "@pincerpay/core";
import { PincerPayError } from "./requirements.js";
import type {
  SettleResponse,
  SupportedResponse,
  TransactionStatus,
  VerifyResponse,
} from "./requirements.js";

export { toBaseUnits } from "./requirements.js";

/** Default request timeout for {@link PincerPayClient}, in milliseconds. */
export const DEFAULT_CLIENT_TIMEOUT_MS = 60_000;

/**
 * Config for {@link PincerPayClient}. A full `PincerPayConfig` also fits, so
 * existing callers keep working. `routes` is not needed here.
 */
export interface PincerPayClientConfig {
  /** Merchant API key (`pp_test_...` or `pp_live_...`) */
  apiKey: string;
  /** Facilitator base URL. A trailing `/v1` is stripped. Defaults to the hosted facilitator. */
  facilitatorUrl?: string;
  /** Per-request timeout in milliseconds. Default 60000. */
  timeoutMs?: number;
  /** Single receiving wallet, kept for callers that read it back */
  merchantAddress?: string;
  /** Per-chain receiving wallets, kept for callers that read them back */
  merchantAddresses?: Record<string, string>;
}

function normalizeFacilitatorUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function stringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * PincerPayClient wraps the facilitator HTTP API for server-side use.
 *
 * Every non-2xx response throws {@link PincerPayError} with `status`, `code`,
 * `body`, and `path`. A timeout or network failure throws status 0.
 */
export class PincerPayClient {
  readonly facilitatorUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
  readonly merchantAddress?: string;
  readonly merchantAddresses?: Record<string, string>;

  constructor(config: PincerPayClientConfig) {
    this.facilitatorUrl = normalizeFacilitatorUrl(config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL);
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS;
    this.merchantAddress = config.merchantAddress;
    this.merchantAddresses = config.merchantAddresses;
  }

  private timeoutError(path: string, cause: unknown): PincerPayError {
    return new PincerPayError(`Facilitator ${path} timed out after ${this.timeoutMs} ms`, {
      status: 0,
      code: "timeout",
      path,
      cause,
    });
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.facilitatorUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            [API_KEY_HEADER]: this.apiKey,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) throw this.timeoutError(path, err);
        throw new PincerPayError(
          `Facilitator ${path} request failed: ${err instanceof Error ? err.message : String(err)}`,
          { status: 0, code: "network_error", path, cause: err },
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Not JSON. The raw text is the body.
        }
        throw new PincerPayError(`Facilitator ${path} failed (${res.status}): ${text}`, {
          status: res.status,
          code:
            stringField(parsed, "error") ??
            stringField(parsed, "errorReason") ??
            stringField(parsed, "invalidReason"),
          body: parsed,
          path,
          retryAfter: parseRetryAfter(res.headers.get("retry-after")),
        });
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof PincerPayError) throw err;
      if (controller.signal.aborted) throw this.timeoutError(path, err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Dry-run a payment against the facilitator. A 200 with `isValid: false`
   * is a normal answer and does not throw.
   */
  async verify(paymentPayload: unknown, paymentRequirements: unknown): Promise<VerifyResponse> {
    return this.request<VerifyResponse>(FACILITATOR_ROUTES.verify, {
      paymentPayload,
      paymentRequirements,
    });
  }

  /**
   * Broadcast a payment. Pass your own stored requirements and never the
   * copy the agent sent. Check `success` on the result.
   */
  async settle(paymentPayload: unknown, paymentRequirements: unknown): Promise<SettleResponse> {
    return this.request<SettleResponse>(FACILITATOR_ROUTES.settle, {
      paymentPayload,
      paymentRequirements,
    });
  }

  /** The schemes, networks, and `extra` fields (Solana `feePayer`) the facilitator settles. */
  async getSupported(): Promise<SupportedResponse> {
    return this.request<SupportedResponse>(FACILITATOR_ROUTES.supported);
  }

  /**
   * Read a settled transaction by hash.
   *
   * Throws {@link PincerPayError} status 404 when no row exists. The
   * facilitator writes the row after it answers `/v1/settle`. A 404 right
   * after a successful settle means the row is not written yet, so retry with
   * backoff for about 30 seconds. A settle that crashed after broadcast is
   * never recorded. A 404 therefore never proves the payment did not happen.
   */
  async getStatus(txHash: string): Promise<TransactionStatus> {
    return this.request<TransactionStatus>(
      `${FACILITATOR_ROUTES.status}/${encodeURIComponent(txHash)}`,
    );
  }
}

/**
 * Resolve route config chains to CAIP-2 network IDs.
 * "base" → "eip155:8453", etc.
 */
export function resolveRouteChains(route: RoutePaywallConfig): string[] {
  const shorthands = route.chains ?? (route.chain ? [route.chain] : ["solana"]);
  return shorthands.map(toCAIP2);
}

/**
 * Get chain-specific USDC asset address from a chain shorthand.
 */
export function getUsdcAsset(chainShorthand: string): string {
  const chain = resolveChain(chainShorthand);
  if (!chain) {
    throw new Error(`Unknown chain: ${chainShorthand}`);
  }
  return chain.usdcAddress;
}
