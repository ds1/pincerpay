import { describe, it, expect } from "vitest";
import { buildTestApp } from "./test-app.js";

/**
 * Regression guard for the CLI-bearer vs API-key middleware collision
 * (#130 / #149), asserted against the REAL app from buildApp().
 *
 * buildApp mounts two sub-apps at "/": `cliAuthenticated` (Authorization:
 * Bearer, scoped to /v1/onboarding/*) and `authenticated` (x-pincerpay-api-key,
 * for /v1/settle, /v1/verify, /v1/transactions, ...). The wiring is load-bearing:
 * cliAuthenticated mounts first, so its bearer middleware MUST be scoped to
 * /v1/onboarding/*. A bare "*" there 401s the entire api-key surface with
 * "missing_bearer_token" — the #130 regression that broke payments in prod (#149).
 *
 * These run the real buildApp, so a future change that rescopes or reorders the
 * auth middleware fails here directly (the mirror-based version could not).
 */
describe("facilitator auth routing (regression #130/#149)", () => {
  it("an api-key path with no key reaches authMiddleware, not the CLI bearer middleware", async () => {
    const res = await buildTestApp().request("/v1/transactions");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    // The #149 regression answered this api-key path with "missing_bearer_token".
    expect(body.error).toBe("Missing API key");
  });

  it("an onboarding path with no bearer reaches the CLI bearer middleware", async () => {
    const res = await buildTestApp().request("/v1/onboarding/health");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_bearer_token");
  });
});
