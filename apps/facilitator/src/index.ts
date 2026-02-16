import { Hono } from "hono";
import { cors } from "hono/cors";
import { x402Facilitator } from "@x402/core/facilitator";
import { createDb } from "@pincerpay/db";
import { loadConfig, parseRpcUrls } from "./config.js";
import { createLogger, loggingMiddleware } from "./middleware/logging.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/ratelimit.js";
import { setupEvmFacilitator } from "./chains/evm.js";
import { parseNetworks, groupByNamespace } from "./chains/registry.js";
import { health } from "./routes/health.js";
import { createSupportedRoute } from "./routes/supported.js";
import { createVerifyRoute } from "./routes/verify.js";
import { createSettleRoute } from "./routes/settle.js";
import { createStatusRoute } from "./routes/status.js";
import { serve } from "@hono/node-server";
import type { AppEnv } from "./env.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);

// ─── Database ───
const { db, close: closeDb } = createDb(config.DATABASE_URL);

// ─── x402 Facilitator ───
const facilitator = new x402Facilitator();

// Register EVM chains
const networks = parseNetworks(config.EVM_NETWORKS);
const grouped = groupByNamespace(networks);
const rpcUrls = parseRpcUrls(config.RPC_URLS);

if (grouped.eip155.length > 0) {
  setupEvmFacilitator(facilitator, {
    privateKey: config.FACILITATOR_PRIVATE_KEY as `0x${string}`,
    networks: grouped.eip155,
    rpcUrls,
    logger,
  });
}

// TODO: Phase 1 — Solana support via @x402/svm
if (grouped.solana.length > 0) {
  logger.warn({ msg: "solana_not_yet_supported", networks: grouped.solana });
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

// Health check (no auth)
app.route("/", health);

// Public endpoint (no auth)
app.route("/", createSupportedRoute(facilitator));

// Authenticated endpoints
const authenticated = new Hono<AppEnv>();
authenticated.use("*", authMiddleware(db));
authenticated.use("*", rateLimitMiddleware(config.RATE_LIMIT_PER_MINUTE));
authenticated.route("/", createVerifyRoute(facilitator));
authenticated.route("/", createSettleRoute(facilitator, db));
authenticated.route("/", createStatusRoute(db));

app.route("/", authenticated);

// ─── Start Server ───
const port = config.PORT;

logger.info({
  msg: "facilitator_starting",
  port,
  networks,
  supported: facilitator.getSupported(),
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({
    msg: "facilitator_ready",
    url: `http://localhost:${info.port}`,
  });
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ msg: "shutting_down", signal });
  server.close(() => {
    closeDb().then(() => {
      logger.info({ msg: "shutdown_complete" });
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
