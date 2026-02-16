import type { Logger } from "./middleware/logging.js";

/** Custom Hono environment with PincerPay context variables */
export type AppEnv = {
  Variables: {
    requestId: string;
    logger: Logger;
    merchantId: string;
    apiKeyId: string;
  };
};
