import type { Logger } from "./middleware/logging.js";

/** Custom Hono environment with PincerPay context variables */
export type AppEnv = {
  Variables: {
    requestId: string;
    logger: Logger;
    /** Set by API-key authMiddleware (pp_live_* on /v1/settle, /v1/verify, etc) */
    merchantId: string;
    apiKeyId: string;
    webhookUrl?: string;
    webhookSecret?: string;
    /** Set by cliAuthMiddleware (pp_cli_* on /v1/onboarding/*) */
    authUserId: string;
    cliSessionId: string;
  };
};
