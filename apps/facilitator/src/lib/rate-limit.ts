import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(c: Context<AppEnv>): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/**
 * Per-IP fixed-window rate limiter. In-memory; resets on process restart.
 * Sufficient for single-instance Railway deployment. If horizontal scaling is
 * added later, swap for a Redis-backed store.
 */
export function ipRateLimit(opts: {
  /** Max requests per window per IP. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Bucket key prefix (so different routes get separate buckets). */
  prefix: string;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ip = getClientIp(c);
    const key = `${opts.prefix}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "rate_limited", retryAfterSeconds: retryAfter }, 429);
    }

    bucket.count++;
    return next();
  };
}

/**
 * Periodic cleanup of expired bucket entries. Called from the facilitator's
 * cleanup interval to keep memory bounded.
 */
export function cleanupBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
