import { pgEnum } from "drizzle-orm/pg-core";

/**
 * API key / resource environment discriminator.
 *
 * Live keys settle real-money payments. Test keys are restricted to chains
 * where ChainConfig.testnet === true and never trigger production webhooks.
 *
 * Stored as a Postgres enum so future variants (e.g. "sandbox", "internal")
 * extend the type without a schema rewrite.
 */
export const environmentEnum = pgEnum("environment", ["live", "test"]);

export type Environment = (typeof environmentEnum.enumValues)[number];
