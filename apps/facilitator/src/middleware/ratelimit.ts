import { type MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding window rate limiter.
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

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    await next();
  };
}

/**
 * Route-specific rate limiter with a separate counter namespace.
 * Use this to apply stricter limits on expensive routes (e.g., /settle).
 */
export function routeRateLimitMiddleware(
  routeName: string,
  maxRequests: number,
  windowMs = 60_000,
): MiddlewareHandler<AppEnv> {
  const store = new Map<string, RateLimitEntry>();

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
    const key = `${routeName}:${apiKeyId ?? c.req.header("x-forwarded-for") ?? "anonymous"}`;

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfterSec));
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    await next();
  };
}
