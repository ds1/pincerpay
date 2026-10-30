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

  async requestWithMethod<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.facilitatorUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers[API_KEY_HEADER] = this.apiKey;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`Facilitator ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Discovery / Health ───

  async getSupported(): Promise<unknown> {
    return this.request(FACILITATOR_ROUTES.supported);
  }

  async getHealth(): Promise<unknown> {
    return this.request(FACILITATOR_ROUTES.health);
  }

  async getMetrics(): Promise<unknown> {
    return this.request(FACILITATOR_ROUTES.metrics);
  }

  async getOpenApiSpec(): Promise<unknown> {
    return this.request("/openapi.json");
  }

  // ─── Transaction Operations ───

  async getStatus(txHash: string): Promise<unknown> {
    this.requireAuth();
    return this.request(`${FACILITATOR_ROUTES.status}/${txHash}`);
  }

  async verifyPayment(paymentPayload: unknown, paymentRequirements: unknown): Promise<unknown> {
    this.requireAuth();
    return this.request(FACILITATOR_ROUTES.verify, { paymentPayload, paymentRequirements });
  }

  async listTransactions(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    chain?: string;
    from?: string;
    to?: string;
    agent?: string;
  }): Promise<unknown> {
    this.requireAuth();
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) query.set(k, String(v));
      }
    }
    const qs = query.toString();
    return this.request(`/v1/transactions${qs ? `?${qs}` : ""}`);
  }

  // ─── Paywall CRUD ───

  async listPaywalls(params?: {
    limit?: number;
    offset?: number;
    active?: boolean;
  }): Promise<unknown> {
    this.requireAuth();
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) query.set(k, String(v));
      }
    }
    const qs = query.toString();
    return this.request(`/v1/paywalls${qs ? `?${qs}` : ""}`);
  }

  async createPaywall(data: {
    endpointPattern: string;
    amount: string;
    description?: string;
    chains?: string[];
  }): Promise<unknown> {
    this.requireAuth();
    return this.requestWithMethod("POST", "/v1/paywalls", data);
  }

  async updatePaywall(id: string, data: {
    amount?: string;
    description?: string;
    chains?: string[];
    isActive?: boolean;
  }): Promise<unknown> {
    this.requireAuth();
    return this.requestWithMethod("PUT", `/v1/paywalls/${id}`, data);
  }

  async deletePaywall(id: string): Promise<void> {
    this.requireAuth();
    await this.requestWithMethod("DELETE", `/v1/paywalls/${id}`);
  }

  // ─── Agent Management ───

  async listAgents(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<unknown> {
    this.requireAuth();
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) query.set(k, String(v));
      }
    }
    const qs = query.toString();
    return this.request(`/v1/agents${qs ? `?${qs}` : ""}`);
  }

  async updateAgent(id: string, data: {
    name?: string;
    status?: string;
    maxPerTransaction?: string;
    maxPerDay?: string;
  }): Promise<unknown> {
    this.requireAuth();
    return this.requestWithMethod("PUT", `/v1/agents/${id}`, data);
  }

  // ─── Webhook Observability ───

  async listWebhooks(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    event?: string;
  }): Promise<unknown> {
    this.requireAuth();
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) query.set(k, String(v));
      }
    }
    const qs = query.toString();
    return this.request(`/v1/webhooks${qs ? `?${qs}` : ""}`);
  }

  async retryWebhook(id: string): Promise<unknown> {
    this.requireAuth();
    return this.requestWithMethod("POST", `/v1/webhooks/${id}/retry`);
  }

  // ─── Merchant Profile ───

  async getMerchantProfile(): Promise<unknown> {
    this.requireAuth();
    return this.request("/v1/merchant");
  }
}
