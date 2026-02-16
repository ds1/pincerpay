import { type MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory sliding window rate limiter.
 * Per API key, resets every `windowMs`.
 */
export function rateLimitMiddleware(maxRequests: number, windowMs = 60_000): MiddlewareHandler<AppEnv> {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 300_000).unref();

  return async (c, next) => {
    const apiKeyId = c.get("apiKeyId");
    const key = apiKeyId ?? c.req.header("x-forwarded-for") ?? "anonymous";

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    await next();
  };
}
