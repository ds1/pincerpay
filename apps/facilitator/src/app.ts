import { Hono } from "hono";
import { cors } from "hono/cors";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Database } from "@pincerpay/db";
import type { Config } from "./config.js";
import type { Logger } from "./middleware/logging.js";
import type { Metrics } from "./metrics.js";
import type { OfacSdnProvider } from "./compliance/ofac-sdn.js";
import type { AppEnv } from "./env.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware, routeRateLimitMiddleware } from "./middleware/ratelimit.js";
import { cliAuthMiddleware } from "./middleware/cli-auth.js";
import { complianceMiddleware } from "./compliance/middleware.js";
import { squadsMiddleware } from "./middleware/squads.js";
import { createHealthRoute } from "./routes/health.js";
import { createSupportedRoute } from "./routes/supported.js";
import { createVerifyRoute } from "./routes/verify.js";
import { createSettleRoute } from "./routes/settle.js";
import { createSettleDirectRoute } from "./routes/settle-direct.js";
import { createStatusRoute } from "./routes/status.js";
import { createOpenApiRoute } from "./routes/openapi.js";
import { createMetricsRoute } from "./routes/metrics.js";
import { createPaywallRoutes } from "./routes/paywalls.js";
import { createTransactionListRoute } from "./routes/transactions-list.js";
import { createAgentRoutes } from "./routes/agents.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import { createMerchantRoute } from "./routes/merchant.js";
import { createAuthRoute } from "./routes/onboarding/auth.js";
import { createMerchantOnboardingRoute } from "./routes/onboarding/merchant.js";
import { createApiKeysOnboardingRoute } from "./routes/onboarding/api-keys.js";
import { createSessionsOnboardingRoute } from "./routes/onboarding/sessions.js";
import { createOnboardingHealthRoute } from "./routes/onboarding/health.js";

type ConfirmationWorker = ReturnType<
  typeof import("./workers/confirmation.js").startConfirmationWorker
>;
type WebhookRetryWorker = ReturnType<
  typeof import("./webhooks/dispatcher.js").startWebhookRetryWorker
>;
type OnChainRecorderWorker = ReturnType<
  typeof import("./workers/on-chain-recorder.js").startOnChainRecorderWorker
>;
type AnchorIntegration = ReturnType<
  typeof import("./chains/solana-anchor.js").setupAnchorIntegration
>;

export interface BuildAppDeps {
  config: Config;
  db: Database;
  facilitator: x402Facilitator;
  metrics: Metrics;
  logger: Logger;
  workers: {
    confirmation: ConfirmationWorker;
    webhookRetry: WebhookRetryWorker;
    onChainRecorder?: OnChainRecorderWorker;
  };
  koraEnabled: boolean;
  koraFeePayer?: string;
  anchorIntegration?: AnchorIntegration;
  ofacProvider?: OfacSdnProvider;
  onboardingEnabled: boolean;
  /** RPC URL for the primary Solana network (Squads validation). */
  solanaRpcUrl: string;
  /** Configured networks (CAIP-2) — used to scope the /v1/supported advertisement. */
  supportedNetworks: string[];
  /** True once SIGTERM/SIGINT drain has started. Owned by the server bootstrap. */
  isShuttingDown: () => boolean;
}

/**
 * Build the facilitator Hono app from already-constructed dependencies.
 *
 * This is intentionally free of side effects (no server, DB connection, or
 * worker startup) so the real route + middleware wiring — including the
 * load-bearing mount order below — can be imported and asserted in tests.
 * `index.ts` owns the bootstrap (config, signers, workers, shutdown) and the
 * server lifecycle.
 */
export function buildApp(deps: BuildAppDeps): Hono<AppEnv> {
  const {
    config,
    db,
    facilitator,
    metrics,
    logger,
    workers,
    koraEnabled,
    koraFeePayer,
    anchorIntegration,
    ofacProvider,
    onboardingEnabled,
    solanaRpcUrl,
    supportedNetworks,
    isShuttingDown,
  } = deps;

  const app = new Hono<AppEnv>();

  // Global middleware
  app.use(
    "*",
    cors({
      origin: config.CORS_ORIGINS
        ? config.CORS_ORIGINS.split(",").map((o) => o.trim())
        : "*",
    }),
  );
  app.use("*", loggingMiddleware(logger));

  // Health check (no auth) — includes DB, worker status, uptime
  app.route("/", createHealthRoute({
    db,
    koraFeePayer,
    workers: {
      confirmation: workers.confirmation,
      webhookRetry: workers.webhookRetry,
      onChainRecorder: workers.onChainRecorder,
    },
    isShuttingDown,
    ...(ofacProvider && { compliance: { provider: ofacProvider } }),
  }));

  // Public endpoints (no auth). /v1/supported is scoped to the configured
  // networks so a testnet-only deploy does not advertise mainnets.
  app.route("/", createSupportedRoute(facilitator, { networks: supportedNetworks }));
  app.route("/", createMetricsRoute(metrics));
  app.route("/", createOpenApiRoute());

  // CLI onboarding — public auth endpoints (signup, verify, login, recover, reset).
  // Each route is IP-rate-limited internally. Only mounts when Supabase + token
  // pepper config is present; otherwise the caller logged the disabled warning.
  if (onboardingEnabled) {
    app.route("/", createAuthRoute(db, { smtpConfigured: !!config.SUPABASE_SMTP_CONFIGURED }));
  }

  // Authenticated endpoints
  const authenticated = new Hono<AppEnv>();

  // Reject new requests during graceful shutdown drain
  authenticated.use("*", async (c, next) => {
    if (isShuttingDown()) {
      c.header("Retry-After", "1");
      return c.json({ error: "Service is shutting down, retry on another instance" }, 503);
    }
    return next();
  });

  authenticated.use("*", authMiddleware(db));
  authenticated.use("*", rateLimitMiddleware(config.RATE_LIMIT_PER_MINUTE));

  // Route-specific rate limits (stricter than global)
  authenticated.use("/v1/settle", routeRateLimitMiddleware("settle", 50));
  authenticated.use("/v1/settle-direct", routeRateLimitMiddleware("settle", 50));
  authenticated.use("/v1/verify", routeRateLimitMiddleware("verify", 100));

  // OFAC compliance screening on settlement routes
  if (ofacProvider) {
    authenticated.use("/v1/settle", complianceMiddleware(ofacProvider));
    authenticated.use("/v1/settle-direct", complianceMiddleware(ofacProvider));
  }

  // Squads SPN spending limit validation (Solana payments only)
  authenticated.use("/v1/settle", squadsMiddleware({ db, rpcUrl: solanaRpcUrl }));
  authenticated.use("/v1/settle-direct", squadsMiddleware({ db, rpcUrl: solanaRpcUrl }));

  authenticated.route("/", createVerifyRoute(facilitator, { metrics }));
  authenticated.route("/", createSettleRoute(facilitator, db, {
    koraEnabled,
    metrics,
    solanaRpcUrl,
    onSettle: () => {
      workers.confirmation.nudge();
      workers.webhookRetry.nudge();
      workers.onChainRecorder?.nudge();
    },
  }));
  if (anchorIntegration) {
    authenticated.route("/", createSettleDirectRoute(db, {
      program: anchorIntegration.program,
      koraEnabled,
    }));
  }
  authenticated.route("/", createStatusRoute(db));

  // CRUD + management routes (Phase 2/3)
  authenticated.use("/v1/paywalls", routeRateLimitMiddleware("paywalls-write", 30));
  authenticated.use("/v1/agents", routeRateLimitMiddleware("agents-write", 30));
  authenticated.use("/v1/webhooks", routeRateLimitMiddleware("webhooks", 30));
  authenticated.route("/", createPaywallRoutes(db));
  authenticated.route("/", createTransactionListRoute(db));
  authenticated.route("/", createAgentRoutes(db));
  authenticated.route("/", createWebhookRoutes(db));
  authenticated.route("/", createMerchantRoute(db));

  // CLI onboarding — authenticated endpoints (merchant management, api keys, sessions).
  // The cliAuthMiddleware below is scoped to "/v1/onboarding/*", NOT "*":
  // mounting in a sub-app does NOT scope a "*" use(); once mounted at "/" it
  // matches every path and 401s the pp_live_* api-key surface.
  //
  // IMPORTANT: must mount BEFORE `authenticated` because Hono evaluates merged
  // routes/middleware in registration order. `authenticated.use("*", authMiddleware)`
  // would otherwise intercept every onboarding request with `Missing API key`
  // before cliAuthMiddleware could see it.
  if (onboardingEnabled) {
    const cliAuthenticated = new Hono<AppEnv>();
    cliAuthenticated.use("*", async (c, next) => {
      if (isShuttingDown()) {
        c.header("Retry-After", "1");
        return c.json({ error: "Service is shutting down, retry on another instance" }, 503);
      }
      return next();
    });
    // Scope to onboarding paths only. A bare "*" matches every request once this
    // sub-app is mounted at "/", which 401s the whole pp_live_* api-key surface
    // (/v1/settle, /v1/verify, etc.) with `missing_bearer_token`. Regression #130.
    cliAuthenticated.use("/v1/onboarding/*", cliAuthMiddleware(db));
    cliAuthenticated.route("/", createMerchantOnboardingRoute(db));
    cliAuthenticated.route("/", createApiKeysOnboardingRoute(db));
    cliAuthenticated.route("/", createSessionsOnboardingRoute(db));
    cliAuthenticated.route("/", createOnboardingHealthRoute(db));
    app.route("/", cliAuthenticated);
  }

  app.route("/", authenticated);

  return app;
}
