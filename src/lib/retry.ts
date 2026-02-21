import { log } from "./logger.js";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Jitter factor 0-1, randomizes delay ± this percentage (default: 0.25) */
  jitter?: number;
  /** Label for log messages (default: "API call") */
  label?: string;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  jitter: 0.25,
  label: "API call",
};

/** Returns true if the error represents a transient failure worth retrying. */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as Error & { status?: number; code?: number | string; statusCode?: number };

  // HTTP status codes
  const status = err.status ?? err.statusCode;
  if (status !== undefined) {
    // 429 = rate limited, 5xx = server error, 529 = Anthropic overloaded
    if (status === 429 || status === 529 || (status >= 500 && status < 600)) return true;
    // 4xx (except 429) = permanent client error
    if (status >= 400 && status < 500) return false;
  }

  // Network error codes
  const code = err.code;
  if (typeof code === "string") {
    const retryableCodes = [
      "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE",
      "EHOSTUNREACH", "EAI_AGAIN", "ENOTFOUND",
    ];
    if (retryableCodes.includes(code)) return true;
  }

  // Network-related error messages as fallback
  const msg = err.message.toLowerCase();
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("socket hang up")) {
    return true;
  }

  return false;
}

/** Extracts retry-after delay in ms from an error, if present. */
function getRetryAfterMs(error: unknown): number | null {
  const err = error as Error & { headers?: Record<string, string>; response?: { headers?: Record<string, string> } };
  const headerValue = err.headers?.["retry-after"] ?? err.response?.headers?.["retry-after"];
  if (!headerValue) return null;

  // Could be seconds (number) or an HTTP date
  const seconds = Number(headerValue);
  if (!isNaN(seconds)) return seconds * 1000;

  const date = Date.parse(headerValue);
  if (!isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

/** Adds jitter to a delay value. Randomizes ± jitter factor. */
function addJitter(delayMs: number, jitter: number): number {
  const range = delayMs * jitter;
  return delayMs + (Math.random() * 2 - 1) * range;
}

/**
 * Executes an async function with exponential backoff retry logic.
 *
 * Retries on transient errors (429, 5xx, network errors).
 * Throws immediately on permanent errors (4xx auth/validation).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay: exponential backoff with jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const retryAfterMs = getRetryAfterMs(error);
      const delay = retryAfterMs ?? addJitter(exponentialDelay, opts.jitter);

      const errMsg = error instanceof Error ? error.message : String(error);
      log.warn(
        `${opts.label} failed (attempt ${attempt + 1}/${opts.maxRetries + 1}): ${errMsg}. ` +
        `Retrying in ${Math.round(delay)}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but satisfy TypeScript
  throw lastError;
}
