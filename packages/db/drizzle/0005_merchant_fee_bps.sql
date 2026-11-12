ALTER TABLE "merchants" ADD COLUMN "fee_bps" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
-- Fee metering (#158, #178). Each transaction amount is the listed price plus
-- PincerPay's cut, so the cut inside one payment is amount * fee_bps / (10000 + fee_bps).
-- The view sums that per merchant, environment, and UTC calendar month.
-- It counts settled x402 payments only. The direct path already pays its fee on chain.
-- fee_amount is in USDC base units, rounded down once per month.
-- Invoicing from this view is a manual monthly step.
CREATE OR REPLACE VIEW "merchant_fee_accruals" WITH (security_invoker = true) AS
SELECT
  t."merchant_id",
  t."environment",
  date_trunc('month', t."created_at" AT TIME ZONE 'UTC')::date AS "month",
  m."fee_bps",
  count(*)::integer AS "transaction_count",
  sum(t."amount"::numeric) AS "gross_amount",
  floor(sum(t."amount"::numeric * m."fee_bps" / (10000 + m."fee_bps"))) AS "fee_amount"
FROM "transactions" t
INNER JOIN "merchants" m ON m."id" = t."merchant_id"
WHERE t."settlement_type" = 'x402'
  AND t."status" IN ('confirmed', 'optimistic')
GROUP BY t."merchant_id", t."environment", date_trunc('month', t."created_at" AT TIME ZONE 'UTC')::date, m."fee_bps";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "merchant_fee_accruals" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "merchant_fee_accruals" FROM authenticated;
  END IF;
END $$;
