---
"@pincerpay/db": patch
---

Add `cli_sessions` and `audit_events` tables for the upcoming CLI/MCP-only onboarding flow.

- `cli_sessions` — opaque `pp_cli_*` bearer tokens minted after CLI signup/login. Hashed (HMAC-SHA256 with server pepper) for storage. Tracks `client_name`, `client_ip_first`, `client_ip_last` for the security UI. `revoked_at TIMESTAMPTZ` (not boolean) preserves audit history. Partial indexes on token_hash + auth_user_id `WHERE revoked_at IS NULL` keep hot-path lookups small.

- `audit_events` — append-only log of security-relevant events (signup, login, key creation, wallet rotation, session revoke). JSONB metadata. Indexed on `(auth_user_id, created_at DESC)` for the per-user activity feed.

Tables sit unused until the facilitator and CLI ship in the next phases. Migration is `drizzle/0002_demonic_wild_pack.sql`; apply via Supabase SQL Editor.
