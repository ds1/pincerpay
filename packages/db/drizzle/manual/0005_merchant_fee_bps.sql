-- ─── FEE METERING (2026-11-11, #158, #178) ─────────────────────────────────
--
-- Paste this file into the Supabase SQL editor and run it once.
-- It matches drizzle/0005_merchant_fee_bps.sql and is safe to run again.
--
-- merchants.fee_bps is PincerPay's cut in basis points. 100 = 1%.
-- The cut rides on top of the listed price, so each transaction amount is
-- the listed price plus the cut. The cut inside one payment is
-- amount * fee_bps / (10000 + fee_bps).
--
-- merchant_fee_accruals sums that cut per merchant, environment, and UTC
-- calendar month. It counts settled x402 payments only. The direct path
-- already pays its fee on chain. fee_amount is in USDC base units, rounded
-- down once per month. Nothing collects the fee at settle time.
--
-- Invoicing is a manual monthly step. Read last month's live rows:
--
--   SELECT * FROM merchant_fee_accruals
--   WHERE environment = 'live'
--     AND month = date_trunc('month', now() AT TIME ZONE 'UTC' - interval '1 month')::date;
--
-- Change one merchant's cut with a SQL update and a dated price note:
--
--   UPDATE merchants SET fee_bps = 100, updated_at = now() WHERE id = '<merchant uuid>';
--
-- The view reads the current fee_bps. A change reprices every month the view
-- reports for that merchant, so invoice the open month before changing it.
--
-- security_invoker keeps the RLS on transactions and merchants in force for
-- whoever queries the view. The REVOKE keeps the anon and authenticated roles
-- out, matching the fail-closed posture in 0004_rls_policies.sql.

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS fee_bps integer DEFAULT 100 NOT NULL;

CREATE OR REPLACE VIEW public.merchant_fee_accruals WITH (security_invoker = true) AS
SELECT
  t.merchant_id,
  t.environment,
  date_trunc('month', t.created_at AT TIME ZONE 'UTC')::date AS month,
  m.fee_bps,
  count(*)::integer AS transaction_count,
  sum(t.amount::numeric) AS gross_amount,
  floor(sum(t.amount::numeric * m.fee_bps / (10000 + m.fee_bps))) AS fee_amount
FROM public.transactions t
INNER JOIN public.merchants m ON m.id = t.merchant_id
WHERE t.settlement_type = 'x402'
  AND t.status IN ('confirmed', 'optimistic')
GROUP BY t.merchant_id, t.environment, date_trunc('month', t.created_at AT TIME ZONE 'UTC')::date, m.fee_bps;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.merchant_fee_accruals FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.merchant_fee_accruals FROM authenticated;
  END IF;
END $$;
