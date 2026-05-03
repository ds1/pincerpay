import { Hono } from "hono";
import { cors } from "hono/cors";
import { x402Facilitator } from "@x402/core/facilitator";
import { createDb } from "@pincerpay/db";
import { loadConfig, parseRpcUrls } from "./config.js";
import { createLogger, loggingMiddleware } from "./middleware/logging.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware, routeRateLimitMiddleware } from "./middleware/ratelimit.js";
import { setupEvmFacilitator } from "./chains/evm.js";
import { setupSolanaFacilitator, setupSolanaFacilitatorWithKora } from "./chains/solana.js";
import { parseNetworks, groupByNamespace } from "./chains/registry.js";
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
import { cliAuthMiddleware } from "./middleware/cli-auth.js";
import { startCleanup } from "./lib/cleanup.js";
import { Metrics } from "./metrics.js";
import { serve } from "@hono/node-server";
import { startConfirmationWorker } from "./workers/confirmation.js";
import { setupAnchorIntegration } from "./chains/solana-anchor.js";
import { startOnChainRecorderWorker } from "./workers/on-chain-recorder.js";
import { startWebhookRetryWorker } from "./webhooks/dispatcher.js";
import { OfacSdnProvider } from "./compliance/ofac-sdn.js";
import { complianceMiddleware } from "./compliance/middleware.js";
import { squadsMiddleware } from "./middleware/squads.js";
import type { AppEnv } from "./env.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL, config.LOGTAIL_SOURCE_TOKEN);
const metrics = new Metrics();

const onboardingEnabled = !!(
  config.SUPABASE_URL &&
  config.SUPABASE_PUBLISHABLE_KEY &&
  config.TOKEN_PEPPER
);

if (config.NODE_ENV === "production" && !config.CORS_ORIGINS) {
  // Fail closed: a misconfigured production deploy with wildcard CORS exposes
  // the facilitator to any origin. Better to refuse to start than to silently
  // accept cross-origin requests.
  throw new Error(
    "CORS_ORIGINS must be set in production. Refusing to start with wildcard CORS.",
  );
}

// ─── Database ───
const { db, close: closeDb } = createDb(config.DATABASE_URL);

// ─── x402 Facilitator ───
const facilitator = new x402Facilitator();

// Parse all configured networks — Solana is primary, EVM is optional
const solanaNetworks = parseNetworks(config.SOLANA_NETWORKS);
const evmNetworks = config.EVM_NETWORKS ? parseNetworks(config.EVM_NETWORKS) : [];
const allNetworks = [...solanaNetworks, ...evmNetworks];
const grouped = groupByNamespace(allNetworks);
const rpcUrls = parseRpcUrls(config.RPC_URLS);

// Track whether Kora is active (affects gas token reporting)
let koraEnabled = false;
let koraFeePayer: string | undefined;

// Register Solana chains (primary)
if (grouped.solana.length > 0) {
  if (config.KORA_RPC_URL) {
    // Kora mode: agents pay USDC for gas
    try {
      const result = await setupSolanaFacilitatorWithKora(facilitator, {
        koraRpcUrl: config.KORA_RPC_URL,
        koraApiKey: config.KORA_API_KEY,
        networks: grouped.solana,
        rpcUrls,
        logger,
      });
      koraEnabled = true;
      koraFeePayer = result.feePayer;
    } catch (err) {
      logger.warn({
        msg: "kora_init_failed_falling_back_to_local_keypair",
        error: err instanceof Error ? err.message : String(err),
        koraRpcUrl: config.KORA_RPC_URL,
      });
      if (config.SOLANA_PRIVATE_KEY) {
        await setupSolanaFacilitator(facilitator, {
          privateKey: config.SOLANA_PRIVATE_KEY,
          networks: grouped.solana,
          rpcUrls,
          logger,
        });
      } else {
        logger.error({ msg: "no_solana_signer_available", hint: "Set SOLANA_PRIVATE_KEY as fallback" });
      }
    }
  } else if (config.SOLANA_PRIVATE_KEY) {
    // Local keypair mode: agents pay SOL for gas
    await setupSolanaFacilitator(facilitator, {
      privateKey: config.SOLANA_PRIVATE_KEY,
      networks: grouped.solana,
      rpcUrls,
      logger,
    });
  }
}

// Register EVM chains (optional)
if (grouped.eip155.length > 0 && config.FACILITATOR_PRIVATE_KEY) {
  setupEvmFacilitator(facilitator, {
    privateKey: config.FACILITATOR_PRIVATE_KEY as `0x${string}`,
    networks: grouped.eip155,
    rpcUrls,
    logger,
  });
} else if (grouped.eip155.length > 0) {
  logger.warn({ msg: "evm_networks_configured_but_no_private_key", networks: grouped.eip155 });
}

// ─── Anchor Program Integration (optional) ───
let anchorIntegration: ReturnType<typeof setupAnchorIntegration> | undefined;

if (config.ANCHOR_PROGRAM_ID) {
  const solanaRpcUrl = rpcUrls[solanaNetworks[0]] ?? "https://api.devnet.solana.com";
  anchorIntegration = setupAnchorIntegration({
    programId: config.ANCHOR_PROGRAM_ID,
    rpcUrl: solanaRpcUrl,
    logger,
  });
}

// ─── Facilitator Hooks ───
facilitator.onAfterSettle(async (ctx) => {
  logger.info({
    msg: "settlement_complete",
    network: ctx.result.network,
    txHash: ctx.result.transaction,
    payer: ctx.result.payer,
  });
});

facilitator.onSettleFailure(async (ctx) => {
  logger.error({
    msg: "settlement_failed",
    error: ctx.error.message,
  });
  return undefined;
});

// ─── Background Workers ───
// Started before HTTP routes so health endpoint can reference them.

const confirmationWorker = startConfirmationWorker(db, {
  rpcUrls,
  logger,
  koraEnabled,
});

const webhookRetryWorker = startWebhookRetryWorker(db, { logger });

// Periodic cleanup: expired/revoked CLI sessions, rate-limit buckets.
const cleanupHandle = onboardingEnabled ? startCleanup(db, logger) : null;

let onChainRecorderWorker: ReturnType<typeof startOnChainRecorderWorker> | undefined;
if (anchorIntegration) {
  onChainRecorderWorker = startOnChainRecorderWorker(db, {
    program: anchorIntegration.program,
    logger,
  });
}

// ─── OFAC Compliance ───
let ofacProvider: OfacSdnProvider | undefined;
if (config.OFAC_ENABLED) {
  ofacProvider = new OfacSdnProvider({
    refreshIntervalMs: config.OFAC_REFRESH_INTERVAL_MS,
    logger,
  });
  await ofacProvider.start();
  logger.info({ msg: "ofac_compliance_enabled", refreshIntervalMs: config.OFAC_REFRESH_INTERVAL_MS });
}

// ─── Hono App ───
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
    confirmation: confirmationWorker,
    webhookRetry: webhookRetryWorker,
    onChainRecorder: onChainRecorderWorker,
  },
  isShuttingDown: () => shuttingDown,
  ...(ofacProvider && { compliance: { provider: ofacProvider } }),
}));

// Public endpoints (no auth)
app.route("/", createSupportedRoute(facilitator));
app.route("/", createMetricsRoute(metrics));
app.route("/", createOpenApiRoute());

// CLI onboarding — public auth endpoints (signup, verify, login, recover, reset).
// Each route is IP-rate-limited internally. Only mounts when Supabase + token
// pepper config is present; otherwise the warning above already fired.
if (onboardingEnabled) {
  app.route("/", createAuthRoute(db));
} else {
  logger.warn({
    msg: "onboarding_disabled_missing_config",
    hint: "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TOKEN_PEPPER to enable CLI onboarding.",
  });
}

// Authenticated endpoints
const authenticated = new Hono<AppEnv>();

// Reject new requests during graceful shutdown drain
authenticated.use("*", async (c, next) => {
  if (shuttingDown) {
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
const solanaRpcUrl = rpcUrls[solanaNetworks[0]] ?? "https://api.devnet.solana.com";
authenticated.use("/v1/settle", squadsMiddleware({ db, rpcUrl: solanaRpcUrl }));
authenticated.use("/v1/settle-direct", squadsMiddleware({ db, rpcUrl: solanaRpcUrl }));

authenticated.route("/", createVerifyRoute(facilitator, { metrics }));
authenticated.route("/", createSettleRoute(facilitator, db, {
  koraEnabled,
  metrics,
  solanaRpcUrl,
  onSettle: () => {
    confirmationWorker.nudge();
    webhookRetryWorker.nudge();
    onChainRecorderWorker?.nudge();
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

app.route("/", authenticated);

// CLI onboarding — authenticated endpoints (merchant management, api keys, sessions).
// Mounted under a separate sub-app so the cliAuthMiddleware is scoped to these
// routes and does not apply to the existing pp_live_* api-key paths.
if (onboardingEnabled) {
  const cliAuthenticated = new Hono<AppEnv>();
  cliAuthenticated.use("*", async (c, next) => {
    if (shuttingDown) {
      c.header("Retry-After", "1");
      return c.json({ error: "Service is shutting down, retry on another instance" }, 503);
    }
    return next();
  });
  cliAuthenticated.use("*", cliAuthMiddleware(db));
  cliAuthenticated.route("/", createMerchantOnboardingRoute(db));
  cliAuthenticated.route("/", createApiKeysOnboardingRoute(db));
  cliAuthenticated.route("/", createSessionsOnboardingRoute(db));
  cliAuthenticated.route("/", createOnboardingHealthRoute(db));
  app.route("/", cliAuthenticated);
}

// ─── Start Server ───
const port = config.PORT;

logger.info({
  msg: "facilitator_starting",
  port,
  networks: allNetworks,
  koraEnabled,
  supported: facilitator.getSupported(),
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({
    msg: "facilitator_ready",
    url: `http://localhost:${info.port}`,
  });
});

// Graceful shutdown
const SHUTDOWN_TIMEOUT_MS = config.SHUTDOWN_TIMEOUT_MS;
let shuttingDown = false;

/** Exposed for health route — returns true once SIGTERM/SIGINT received */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

async function shutdown(signal: string) {
  if (shuttingDown) return; // Prevent double-shutdown
  shuttingDown = true;

  logger.info({ msg: "shutting_down", signal });

  // 1. Stop accepting new connections, drain in-flight requests
  const serverClosed = new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  // 2. Stop workers (await current cycles)
  const workerStops = Promise.all([
    confirmationWorker.stop(),
    webhookRetryWorker.stop(),
    onChainRecorderWorker?.stop(),
  ]);

  // 2b. Stop OFAC provider refresh timer + cleanup interval
  ofacProvider?.stop();
  cleanupHandle?.stop();

  // 3. Race workers + server close against timeout
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );

  const result = await Promise.race([
    Promise.all([workerStops, serverClosed]).then(() => "clean" as const),
    timeout,
  ]);

  if (result === "timeout") {
    logger.warn({ msg: "shutdown_timeout", timeoutMs: SHUTDOWN_TIMEOUT_MS });
  }

  // 4. Close database last (workers may have written during drain)
  await closeDb();

  logger.info({ msg: "shutdown_complete", clean: result !== "timeout" });
  process.exit(result === "timeout" ? 1 : 0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
