import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchants } from "./merchants";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** CAIP-2 chain ID (e.g., "eip155:8453") */
    chainId: text("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    /** USDC amount in base units (e.g., "1000000" = 1 USDC) */
    amount: text("amount").notNull(),
    /** Gas cost in USDC base units */
    gasCost: text("gas_cost").notNull().default("0"),
    /** pending | mempool | optimistic | confirmed | failed */
    status: text("status").notNull().default("pending"),
    /** Whether optimistic finality was used */
    optimistic: boolean("optimistic").notNull().default(false),
    /** Endpoint that was paid for */
    endpoint: text("endpoint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("transactions_merchant_id_idx").on(table.merchantId),
    index("transactions_tx_hash_idx").on(table.txHash),
    index("transactions_status_idx").on(table.status),
    index("transactions_created_at_idx").on(table.createdAt),
    index("transactions_merchant_chain_created_idx").on(table.merchantId, table.chainId, table.createdAt),
  ],
);
