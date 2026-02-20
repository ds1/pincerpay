import {
  DEFAULT_FACILITATOR_URL,
  FACILITATOR_ROUTES,
  API_KEY_HEADER,
} from "@pincerpay/core";

export interface FacilitatorClientConfig {
  /** PincerPay API key (pp_live_... or pp_test_...) */
  apiKey?: string;
  /** Facilitator URL (defaults to https://facilitator.pincerpay.com) */
  facilitatorUrl?: string;
}

/**
 * Lightweight HTTP client for the PincerPay facilitator API.
 * Follows the same pattern as PincerPayClient in @pincerpay/merchant
 * but without requiring merchantAddress — designed for MCP server use.
 */
export class FacilitatorClient {
  readonly facilitatorUrl: string;
  readonly apiKey?: string;

  constructor(config: FacilitatorClientConfig) {
    this.facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;
    this.apiKey = config.apiKey;
  }

  get isAuthenticated(): boolean {
    return !!this.apiKey;
  }

  /**
   * Throws if no API key is configured. Call before operations
   * that require authentication.
   */
  requireAuth(): void {
    if (!this.apiKey) {
      throw new Error(
        "This operation requires a PincerPay API key. " +
          "Set PINCERPAY_API_KEY environment variable or pass --api-key to the MCP server.",
      );
    }
  }

  async request<T>(path: string, body?: unknown): Promise<T> {
    const url = `${this.facilitatorUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers[API_KEY_HEADER] = this.apiKey;
    }

    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`Facilitator ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getSupported(): Promise<unknown> {
    return this.request(FACILITATOR_ROUTES.supported);
  }

  async getStatus(txHash: string): Promise<unknown> {
    this.requireAuth();
    return this.request(`${FACILITATOR_ROUTES.status}/${txHash}`);
  }

  async getHealth(): Promise<unknown> {
    return this.request(FACILITATOR_ROUTES.health);
  }

  async getOpenApiSpec(): Promise<unknown> {
    return this.request("/openapi.json");
  }
}
