import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  supportedChains: text("supported_chains").array().notNull().default([]),
  webhookUrl: text("webhook_url"),
  /** Supabase Auth user ID */
  authUserId: text("auth_user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
