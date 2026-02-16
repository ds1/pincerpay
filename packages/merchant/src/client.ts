import {
  DEFAULT_FACILITATOR_URL,
  FACILITATOR_ROUTES,
  API_KEY_HEADER,
} from "@pincerpay/core";
import type {
  PincerPayConfig,
  RoutePaywallConfig,
} from "@pincerpay/core";
import { resolveChain, toCAIP2 } from "@pincerpay/core";

/**
 * PincerPayClient wraps the facilitator HTTP API.
 * Used by merchant middleware to verify and settle payments.
 */
export class PincerPayClient {
  readonly facilitatorUrl: string;
  readonly apiKey: string;
  readonly merchantAddress: string;

  constructor(config: PincerPayConfig) {
    this.facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;
    this.apiKey = config.apiKey;
    this.merchantAddress = config.merchantAddress;
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.facilitatorUrl}${path}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        [API_KEY_HEADER]: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`Facilitator ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async verify(paymentPayload: unknown, paymentRequirements: unknown) {
    return this.request(FACILITATOR_ROUTES.verify, {
      paymentPayload,
      paymentRequirements,
    });
  }

  async settle(paymentPayload: unknown, paymentRequirements: unknown) {
    return this.request(FACILITATOR_ROUTES.settle, {
      paymentPayload,
      paymentRequirements,
    });
  }

  async getSupported() {
    return this.request(FACILITATOR_ROUTES.supported);
  }

  async getStatus(txHash: string) {
    return this.request(`${FACILITATOR_ROUTES.status}/${txHash}`);
  }
}

/**
 * Resolve route config chains to CAIP-2 network IDs.
 * "base" → "eip155:8453", etc.
 */
export function resolveRouteChains(route: RoutePaywallConfig): string[] {
  const shorthands = route.chains ?? (route.chain ? [route.chain] : ["base"]);
  return shorthands.map(toCAIP2);
}

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
