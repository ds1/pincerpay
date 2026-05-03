-- ─── CURRENT POLICY STATE (2026-05-02) ──────────────────────────────────────
--
-- All public tables have RLS enabled with ZERO policies. This is intentional
-- fail-closed: anon and authenticated roles cannot read or write anything.
-- The security boundary is the postgres-role connection used by Drizzle in
-- both the facilitator (DATABASE_URL) and the dashboard (getDb()). The
-- postgres role is the table owner and bypasses RLS by default.
--
-- If a future change exposes a Supabase client-side data path (realtime
-- subscriptions, anon-key reads, third-party connections) those callers will
-- get empty results until per-table policies are added. That's a feature,
-- not a bug. It forces the new path through an explicit security review.
-- See _planning/decisions/decision-docs/ if/when policies get added.

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paywalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cli_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;