import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchants } from "./merchants.js";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Solana public key (base58) */
    solanaAddress: text("solana_address").notNull(),
    /** Squads Smart Account PDA */
    smartAccountPda: text("smart_account_pda"),
    /** Squads Settings PDA */
    settingsPda: text("settings_pda"),
    /** Squads Spending Limit PDA */
    spendingLimitPda: text("spending_limit_pda"),
    /** Max USDC per transaction in base units (e.g., "1000000" = 1 USDC) */
    maxPerTransaction: text("max_per_transaction"),
    /** Max USDC per day in base units */
    maxPerDay: text("max_per_day"),
    /** active | paused | revoked */
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agents_merchant_id_idx").on(table.merchantId),
    index("agents_solana_address_idx").on(table.solanaAddress),
    index("agents_status_idx").on(table.status),
  ],
);
