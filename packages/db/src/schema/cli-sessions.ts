import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Long-lived bearer tokens minted by the facilitator after a successful CLI
 * signup or login. Used as `Authorization: Bearer pp_cli_*` for subsequent
 * onboarding API calls (merchant management, API key minting, etc.).
 *
 * Tokens are opaque + checksum-suffixed for typo detection. Stored as an
 * HMAC-SHA256 hash with a server-side pepper (TOKEN_PEPPER env var); the raw
 * token is returned to the CLI exactly once at creation time.
 *
 * Default lifetime: 30 days. Revoked sessions retain a row with `revoked_at`
 * set for audit purposes; the periodic cleanup deletes rows revoked > 30 days
 * ago.
 */
export const cliSessions = pgTable(
  "cli_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Supabase Auth user id this session was minted for. */
    authUserId: text("auth_user_id").notNull(),

    /** HMAC-SHA256(TOKEN_PEPPER, raw_token) — used for token lookup. */
    tokenHash: text("token_hash").notNull().unique(),

    /** First 14 chars shown to user (e.g., "pp_cli_a1b2c3"). Audit only. */
    prefix: text("prefix").notNull(),

    /** Human-readable label, e.g. "MacBook Pro" or "CI runner". */
    label: text("label").notNull().default("CLI"),

    /** Self-reported client identifier, e.g. "pincerpay-cli/0.1.0". */
    clientName: text("client_name"),

    /** IP address that minted this session. Audit only. */
    clientIpFirst: text("client_ip_first"),

    /** Most recent IP that used this session. Updated async on each request. */
    clientIpLast: text("client_ip_last"),

    /** OAuth-style scope string. v1 always "merchant:* api-keys:*". */
    scope: text("scope").notNull().default("merchant:* api-keys:*"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Set when the session is revoked. NULL means active. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** "user" | "admin" | "expired" | "compromised" | "auth_user_deleted" */
    revokedReason: text("revoked_reason"),
  },
  (table) => [
    check(
      "cli_sessions_revoked_reason_valid",
      sql`${table.revokedReason} IS NULL OR ${table.revokedReason} IN ('user','admin','expired','compromised','auth_user_deleted')`,
    ),
    // Hot-path lookups: only active sessions need to be in the lookup index.
    index("cli_sessions_token_hash_active_idx")
      .on(table.tokenHash)
      .where(sql`${table.revokedAt} IS NULL`),
    index("cli_sessions_auth_user_id_active_idx")
      .on(table.authUserId)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);
