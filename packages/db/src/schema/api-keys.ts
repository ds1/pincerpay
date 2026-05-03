import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { merchants } from "./merchants.js";
import { environmentEnum } from "./enums.js";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the full API key */
    keyHash: text("key_hash").notNull().unique(),
    /** First 12 chars shown to user (e.g., "pp_live_abc1" or "pp_test_abc1") */
    prefix: text("prefix").notNull(),
    label: text("label").notNull().default("Default"),
    isActive: boolean("is_active").notNull().default(true),
    /** Live or test. A test key cannot settle on a mainnet chain. */
    environment: environmentEnum("environment").notNull().default("live"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    index("api_keys_merchant_id_idx").on(table.merchantId),
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_merchant_env_active_idx")
      .on(table.merchantId, table.environment, table.isActive)
      .where(sql`${table.isActive} = true`),
  ],
);
