import type { Database } from "@pincerpay/db";
import { auditEvents } from "@pincerpay/db";

export type AuditEventType =
  | "signup.started"
  | "signup.completed"
  | "signup.failed"
  | "email.verified"
  | "login.completed"
  | "login.failed"
  | "logout"
  | "password.recovery_sent"
  | "password.reset"
  | "password.changed"
  | "cli_session.minted"
  | "cli_session.revoked"
  | "merchant.created"
  | "merchant.updated"
  | "wallet.changed"
  | "api_key.created"
  | "api_key.rotated"
  | "api_key.revoked";

export interface AuditEntry {
  authUserId?: string | null;
  merchantId?: string | null;
  eventType: AuditEventType;
  metadata?: Record<string, unknown>;
  clientIp?: string | null;
  clientName?: string | null;
}

/**
 * Append an event to audit_events. Best-effort — failures are logged but do
 * not propagate, since audit failure should not abort a successful operation.
 */
export async function audit(
  db: Database,
  entry: AuditEntry,
  logger?: { warn: (obj: object) => void },
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      authUserId: entry.authUserId ?? null,
      merchantId: entry.merchantId ?? null,
      eventType: entry.eventType,
      metadata: entry.metadata ?? null,
      clientIp: entry.clientIp ?? null,
      clientName: entry.clientName ?? null,
    });
  } catch (err) {
    logger?.warn({
      msg: "audit_write_failed",
      eventType: entry.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
