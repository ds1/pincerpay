import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { merchants } from "./merchants.js";

/**
 * Append-only log of security-relevant events tied to a Supabase Auth user
 * and (optionally) a merchant. Written by the onboarding endpoints and CLI
 * auth middleware. Surfaced to merchants via the dashboard's security page
 * so they can detect compromise (unexpected logins, key creations, wallet
 * rotations).
 *
 * Event types in v1:
 *   - signup.completed
 *   - login.completed
 *   - login.failed
 *   - email.verified
 *   - password.recovered
 *   - password.changed
 *   - cli_session.minted
 *   - cli_session.revoked
 *   - cli_session.expired
 *   - merchant.created
 *   - merchant.updated
 *   - wallet.changed
 *   - api_key.created
 *   - api_key.rotated
 *   - api_key.revoked
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    authUserId: text("auth_user_id"),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),

    eventType: text("event_type").notNull(),

    /** Free-form structured metadata (e.g. {label, prefix, oldAddress, newAddress}). */
    metadata: jsonb("metadata"),

    clientIp: text("client_ip"),
    clientName: text("client_name"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_auth_user_id_created_at_idx")
      .on(table.authUserId, sql`${table.createdAt} DESC`),
    index("audit_events_merchant_id_created_at_idx")
      .on(table.merchantId, sql`${table.createdAt} DESC`),
    index("audit_events_event_type_idx").on(table.eventType),
  ],
);
