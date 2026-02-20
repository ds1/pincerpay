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
import { serve } from "@hono/node-server";
import { startConfirmationWorker } from "./workers/confirmation.js";
import { setupAnchorIntegration } from "./chains/solana-anchor.js";
import { startOnChainRecorderWorker } from "./workers/on-chain-recorder.js";
import { startWebhookRetryWorker } from "./webhooks/dispatcher.js";
import type { AppEnv } from "./env.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);

if (config.NODE_ENV === "production" && !config.CORS_ORIGINS) {
  logger.warn({ msg: "CORS_ORIGINS not set — defaulting to wildcard (*). Set this in production." });
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
    const result = await setupSolanaFacilitatorWithKora(facilitator, {
      koraRpcUrl: config.KORA_RPC_URL,
      koraApiKey: config.KORA_API_KEY,
      networks: grouped.solana,
      rpcUrls,
      logger,
    });
    koraEnabled = true;
    koraFeePayer = result.feePayer;
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

let onChainRecorderWorker: ReturnType<typeof startOnChainRecorderWorker> | undefined;
if (anchorIntegration) {
  onChainRecorderWorker = startOnChainRecorderWorker(db, {
    program: anchorIntegration.program,
    logger,
  });
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
}));

// Public endpoints (no auth)
app.route("/", createSupportedRoute(facilitator));
app.route("/", createOpenApiRoute());

// Authenticated endpoints
const authenticated = new Hono<AppEnv>();
authenticated.use("*", authMiddleware(db));
authenticated.use("*", rateLimitMiddleware(config.RATE_LIMIT_PER_MINUTE));

// Route-specific rate limits (stricter than global)
authenticated.use("/v1/settle", routeRateLimitMiddleware("settle", 50));
authenticated.use("/v1/settle-direct", routeRateLimitMiddleware("settle", 50));
authenticated.use("/v1/verify", routeRateLimitMiddleware("verify", 100));

authenticated.route("/", createVerifyRoute(facilitator));
authenticated.route("/", createSettleRoute(facilitator, db, { koraEnabled }));
if (anchorIntegration) {
  authenticated.route("/", createSettleDirectRoute(db, {
    program: anchorIntegration.program,
    koraEnabled,
  }));
}
authenticated.route("/", createStatusRoute(db));

app.route("/", authenticated);

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
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

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
