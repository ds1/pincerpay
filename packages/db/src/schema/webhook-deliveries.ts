import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { transactions } from "./transactions.js";
import { merchants } from "./merchants.js";
import { environmentEnum } from "./enums.js";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .references(() => transactions.id, { onDelete: "set null" }),
    /** Live or test. Inherited from the originating transaction; retry worker filters per env. */
    environment: environmentEnum("environment").notNull().default("live"),
    /** The event type (e.g., "payment.settled", "payment.confirmed", "payment.failed") */
    event: text("event").notNull(),
    /** The webhook URL that was called */
    url: text("url").notNull(),
    /** JSON-encoded request payload */
    payload: text("payload").notNull(),
    /** Current delivery status: pending | delivered | retrying | failed */
    status: text("status").notNull().default("pending"),
    /** HTTP status code from last attempt (null if network error) */
    statusCode: integer("status_code"),
    /** Error message from last attempt */
    lastError: text("last_error"),
    /** Number of delivery attempts so far */
    attempts: integer("attempts").notNull().default(0),
    /** Maximum attempts before marking as failed */
    maxAttempts: integer("max_attempts").notNull().default(5),
    /** When the next retry should be attempted */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the webhook was successfully delivered */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("webhook_deliveries_merchant_id_idx").on(table.merchantId),
    index("webhook_deliveries_transaction_id_idx").on(table.transactionId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_next_retry_idx").on(table.status, table.nextRetryAt),
    index("webhook_deliveries_merchant_env_status_retry_idx").on(
      table.merchantId,
      table.environment,
      table.status,
      table.nextRetryAt,
    ),
  ],
);
