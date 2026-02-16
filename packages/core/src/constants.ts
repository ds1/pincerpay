/** Default PincerPay facilitator URL */
export const DEFAULT_FACILITATOR_URL = "https://facilitator.pincerpay.com";

/** Facilitator API version prefix */
export const API_VERSION = "v1";

/** Facilitator routes */
export const FACILITATOR_ROUTES = {
  verify: `/${API_VERSION}/verify`,
  settle: `/${API_VERSION}/settle`,
  status: `/${API_VERSION}/status`,
  supported: `/${API_VERSION}/supported`,
  health: "/health",
} as const;

/** USDC decimals (consistent across all chains) */
export const USDC_DECIMALS = 6;

/** Optimistic finality threshold in USDC base units (1 USDC = 1_000_000) */
export const OPTIMISTIC_THRESHOLD = "1000000";

/** API key prefix length (shown to users, e.g., "pp_live_abc...") */
export const API_KEY_PREFIX_LENGTH = 12;

/** API key header name */
export const API_KEY_HEADER = "x-pincerpay-api-key";

/** Rate limit defaults */
export const RATE_LIMIT = {
  /** Max requests per minute per API key */
  perMinute: 120,
  /** Max requests per second per API key (burst) */
  perSecond: 20,
} as const;

/** Transaction status poll interval in ms */
export const TX_POLL_INTERVAL_MS = 2000;

/** Maximum time to wait for tx confirmation in ms */
export const TX_CONFIRMATION_TIMEOUT_MS = 120_000;
