import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { cliAuthMiddleware } from "../middleware/cli-auth.js";
import type { AppEnv } from "../env.js";
import type { Logger } from "../middleware/logging.js";
import type { Database } from "@pincerpay/db";

/**
 * Regression guard for the CLI-bearer vs API-key middleware collision (#130).
 *
 * Two sub-apps mount at "/": `cliAuthenticated` (Authorization: Bearer, for the
 * /v1/onboarding/* surface) and `authenticated` (x-pincerpay-api-key, for
 * /v1/settle, /v1/verify, /v1/transactions, ...). Both register their auth
 * middleware globally-ish, so the wiring is load-bearing:
 *
 *   - `authenticated.use("*", authMiddleware)` is global, so cliAuthenticated
 *     must mount FIRST or onboarding requests get "Missing API key".
 *   - because cliAuthenticated mounts first, its bearer middleware MUST be
 *     scoped to "/v1/onboarding/*". A bare "*" matches every path and 401s the
 *     entire api-key surface with "missing_bearer_token" (the #130 regression).
 *
 * This mirrors the mounting in index.ts (no app factory exists to import the
 * real app yet — see follow-up). buildApp() is parameterized on the CLI pattern
 * so the failure mode is encoded explicitly alongside the fix.
 */
function buildApp(cliPattern: string) {
  // No-header requests short-circuit in both middlewares before any DB access,
  // so a stub db is never dereferenced.
  const db = {} as unknown as Database;
  const noopLogger = { warn() {}, info() {}, error() {}, debug() {} } as unknown as Logger;

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("logger", noopLogger);
    await next();
  });

  // Order + scope must match index.ts: cliAuthenticated first, scoped to onboarding.
  const cliAuthenticated = new Hono<AppEnv>();
  cliAuthenticated.use(cliPattern, cliAuthMiddleware(db));
  cliAuthenticated.get("/v1/onboarding/health", (c) => c.json({ ok: true }));
  app.route("/", cliAuthenticated);

  const authenticated = new Hono<AppEnv>();
  authenticated.use("*", authMiddleware(db));
  authenticated.get("/v1/transactions", (c) => c.json({ ok: true }));
  app.route("/", authenticated);

  return app;
}

describe("facilitator auth routing (regression: #130 cli/api-key middleware scope)", () => {
  it("scoped: an api-key path with no key reaches authMiddleware, not the CLI middleware", async () => {
    const res = await buildApp("/v1/onboarding/*").request("/v1/transactions");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing API key");
  });

  it("scoped: an onboarding path with no bearer reaches the CLI middleware", async () => {
    const res = await buildApp("/v1/onboarding/*").request("/v1/onboarding/health");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_bearer_token");
  });

  it("regression: a bare \"*\" CLI pattern hijacks the api-key surface (the #130 bug)", async () => {
    const res = await buildApp("*").request("/v1/transactions");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    // With "*" the CLI bearer middleware (mounted first) intercepts every path.
    expect(body.error).toBe("missing_bearer_token");
  });
});
