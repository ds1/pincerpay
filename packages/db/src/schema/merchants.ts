import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  supportedChains: text("supported_chains").array().notNull().default([]),
  /** Live-mode webhook destination. Receives deliveries originating from pp_live_* keys. */
  webhookUrlLive: text("webhook_url_live"),
  /** HMAC-SHA256 shared secret for live webhook signature verification (hex-encoded, 32 bytes) */
  webhookSecretLive: text("webhook_secret_live"),
  /** Test-mode webhook destination. Receives deliveries originating from pp_test_* keys. */
  webhookUrlTest: text("webhook_url_test"),
  /** HMAC-SHA256 shared secret for test webhook signature verification (hex-encoded, 32 bytes) */
  webhookSecretTest: text("webhook_secret_test"),
  /** Supabase Auth user ID */
  authUserId: text("auth_user_id").notNull().unique(),
  /** Whether this merchant has been registered on-chain via Anchor program */
  onChainRegistered: boolean("on_chain_registered").notNull().default(false),
  /** On-chain MerchantAccount PDA address (null if not registered) */
  merchantPda: text("merchant_pda"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
