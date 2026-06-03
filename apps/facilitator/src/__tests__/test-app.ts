// Shared test harness: constructs the REAL facilitator app via buildApp() with
// lightweight stub dependencies, so route + middleware wiring (mount order, auth
// scoping, /v1/supported filtering) is asserted against production code rather
// than a mirror. No-header requests short-circuit in the auth middlewares before
// any DB access, so the stub db is never dereferenced.
import type { Hono } from "hono";
import { buildApp, type BuildAppDeps } from "../app.js";
import type { AppEnv } from "../env.js";
import type { Config } from "../config.js";
import type { Logger } from "../middleware/logging.js";
import type { Metrics } from "../metrics.js";
import type { Database } from "@pincerpay/db";
import type { x402Facilitator } from "@x402/core/facilitator";

const noop = () => {};

const stubWorker = {
  nudge: noop,
  stop: async () => {},
} as unknown as BuildAppDeps["workers"]["confirmation"];

export interface TestAppOverrides {
  supportedKinds?: Array<{ x402Version: number; scheme: string; network: string }>;
  supportedNetworks?: string[];
  onboardingEnabled?: boolean;
  isShuttingDown?: () => boolean;
}

export function buildTestApp(overrides: TestAppOverrides = {}): Hono<AppEnv> {
  const db = {} as unknown as Database;
  const logger = { warn: noop, info: noop, error: noop, debug: noop } as unknown as Logger;
  const facilitator = {
    getSupported: () => ({
      kinds: overrides.supportedKinds ?? [],
      extensions: [],
      signers: {},
    }),
  } as unknown as x402Facilitator;

  return buildApp({
    config: {
      CORS_ORIGINS: undefined,
      RATE_LIMIT_PER_MINUTE: 1000,
      SUPABASE_SMTP_CONFIGURED: false,
    } as unknown as Config,
    db,
    facilitator,
    metrics: {} as unknown as Metrics,
    logger,
    workers: {
      confirmation: stubWorker,
      webhookRetry: stubWorker,
      onChainRecorder: undefined,
    },
    koraEnabled: false,
    onboardingEnabled: overrides.onboardingEnabled ?? true,
    solanaRpcUrl: "https://api.devnet.solana.com",
    supportedNetworks: overrides.supportedNetworks ?? [],
    isShuttingDown: overrides.isShuttingDown ?? (() => false),
  });
}
