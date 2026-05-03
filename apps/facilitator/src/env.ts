import type { Logger } from "./middleware/logging.js";
import type { Environment } from "@pincerpay/db";

/** Custom Hono environment with PincerPay context variables */
export type AppEnv = {
  Variables: {
    requestId: string;
    logger: Logger;
    /** Set by API-key authMiddleware (pp_live_* / pp_test_* on /v1/settle, /v1/verify, etc) */
    merchantId: string;
    apiKeyId: string;
    /** Environment of the API key in use. Determines settle eligibility and webhook destination. */
    environment: Environment;
    /** Webhook URL for the active environment (live or test). Resolved by authMiddleware. */
    webhookUrl?: string;
    /** Webhook signing secret for the active environment. */
    webhookSecret?: string;
    /** Set by cliAuthMiddleware (pp_cli_* on /v1/onboarding/*) */
    authUserId: string;
    cliSessionId: string;
  };
};
