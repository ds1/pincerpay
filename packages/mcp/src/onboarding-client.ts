import type { PublicCredentials } from "./auth-mode.js";

export class OnboardingApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "OnboardingApiError";
    this.status = status;
    this.body = body;
  }
}

export interface OnboardingClient {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function createOnboardingClient(creds: PublicCredentials): OnboardingClient {
  const baseUrl = creds.facilitatorUrl.replace(/\/+$/, "");
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${creds.accessToken}`,
          "user-agent": "pincerpay-mcp/0.7.0",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }

      if (!res.ok) {
        const message =
          (data as { error?: string; message?: string })?.message ??
          (data as { error?: string })?.error ??
          `http_${res.status}`;
        throw new OnboardingApiError(res.status, message, data);
      }
      return data as T;
    },
  };
}
