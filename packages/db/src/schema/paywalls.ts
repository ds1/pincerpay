import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchants } from "./merchants.js";

export const paywalls = pgTable(
  "paywalls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** HTTP method + path pattern (e.g., "GET /api/weather") */
    endpointPattern: text("endpoint_pattern").notNull(),
    /** USDC amount as string (e.g., "0.01") */
    amount: text("amount").notNull(),
    /** Override supported chains for this paywall */
    chains: text("chains").array(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paywalls_merchant_id_idx").on(table.merchantId),
  ],
);
