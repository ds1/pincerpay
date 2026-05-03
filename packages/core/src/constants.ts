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
  metrics: `/${API_VERSION}/metrics`,
  paywalls: `/${API_VERSION}/paywalls`,
  transactions: `/${API_VERSION}/transactions`,
  agents: `/${API_VERSION}/agents`,
  webhooks: `/${API_VERSION}/webhooks`,
  merchant: `/${API_VERSION}/merchant`,
} as const;

/** USDC decimals (consistent across all chains) */
export const USDC_DECIMALS = 6;

/** Optimistic finality threshold in USDC base units (1 USDC = 1_000_000) */
export const OPTIMISTIC_THRESHOLD = "1000000";

/** API key prefix length (shown to users, e.g., "pp_live_abc..." / "pp_test_abc...") */
export const API_KEY_PREFIX_LENGTH = 12;

/** Live-mode API key word prefix. */
export const API_KEY_LIVE_PREFIX = "pp_live_";

/** Test-mode API key word prefix. Test keys cannot settle on mainnet chains. */
export const API_KEY_TEST_PREFIX = "pp_test_";

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
