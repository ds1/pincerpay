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

// Health check (no auth) — includes Kora status when configured
app.route("/", createHealthRoute({ koraFeePayer }));

// Public endpoint (no auth)
app.route("/", createSupportedRoute(facilitator));

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

// Start background confirmation worker for optimistic transactions
const confirmationWorker = startConfirmationWorker(db, {
  rpcUrls,
  logger,
  koraEnabled,
});

// Start webhook retry worker (retries failed webhook deliveries)
const webhookRetryWorker = startWebhookRetryWorker(db, { logger });

// Start on-chain recorder worker (records x402 settlements on-chain for audit)
let onChainRecorderWorker: ReturnType<typeof startOnChainRecorderWorker> | undefined;
if (anchorIntegration) {
  onChainRecorderWorker = startOnChainRecorderWorker(db, {
    program: anchorIntegration.program,
    logger,
  });
}

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ msg: "shutting_down", signal });
  confirmationWorker.stop();
  webhookRetryWorker.stop();
  onChainRecorderWorker?.stop();
  server.close(() => {
    closeDb().then(() => {
      logger.info({ msg: "shutdown_complete" });
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
