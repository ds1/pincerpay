import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchants } from "./merchants.js";
import { agents } from "./agents.js";

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
    /** Gas/fee cost in base units of gasToken. Updated by confirmation worker. */
    gasCost: text("gas_cost").notNull().default("0"),
    /** Token used for transaction fees (ETH, SOL, MATIC, USDC). Defaults to ETH for backwards compat. */
    gasToken: text("gas_token").notNull().default("ETH"),
    /** pending | mempool | optimistic | confirmed | failed */
    status: text("status").notNull().default("pending"),
    /** Whether optimistic finality was used */
    optimistic: boolean("optimistic").notNull().default(false),
    /** Solana slot number (null for EVM transactions) */
    slot: text("slot"),
    /** Solana priority fee in microlamports (null for EVM) */
    priorityFee: text("priority_fee"),
    /** Solana compute units consumed (null for EVM) */
    computeUnits: text("compute_units"),
    /** Agent that initiated this transaction (null if direct/unknown) */
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
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
