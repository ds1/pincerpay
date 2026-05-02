import { loadCredentials } from "./credentials.js";

export const DEFAULT_FACILITATOR_URL = "https://facilitator.pincerpay.com";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ClientOptions {
  /** Override the facilitator base URL (or set PINCERPAY_FACILITATOR_URL env). */
  facilitatorUrl?: string;
  /** Pass an explicit access token (otherwise loaded from ~/.pincerpay/credentials.json). */
  accessToken?: string;
  /** Self-reported client name for audit logs. */
  clientName?: string;
}

export interface ApiClient {
  /** Resolved base URL. */
  baseUrl: string;
  /** Whether an access token was found. */
  authenticated: boolean;
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function createClient(options: ClientOptions = {}): ApiClient {
  const stored = loadCredentials();
  const baseUrl = (
    options.facilitatorUrl ??
    process.env.PINCERPAY_FACILITATOR_URL ??
    stored?.facilitatorUrl ??
    DEFAULT_FACILITATOR_URL
  ).replace(/\/+$/, "");
  const token = options.accessToken ?? stored?.accessToken ?? null;
  const clientName = options.clientName ?? `pincerpay-cli/${getPackageVersion()}`;

  return {
    baseUrl,
    authenticated: !!token,
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const url = `${baseUrl}${path}`;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "user-agent": clientName,
      };
      if (token) headers.authorization = `Bearer ${token}`;

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        throw new ApiError(0, `network_error: ${err instanceof Error ? err.message : String(err)}`, null);
      }

      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }

      if (!res.ok) {
        const message = (data as { error?: string; message?: string })?.message
          ?? (data as { error?: string })?.error
          ?? `http_${res.status}`;
        throw new ApiError(res.status, message, data);
      }

      return data as T;
    },
  };
}

function getPackageVersion(): string {
  // Set at build time via tsc inlining of import.meta.url; default to a sane string.
  return "0.1.0";
}
