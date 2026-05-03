CREATE TYPE "public"."environment" AS ENUM('live', 'test');--> statement-breakpoint
ALTER TABLE "merchants" RENAME COLUMN "webhook_url" TO "webhook_url_live";--> statement-breakpoint
ALTER TABLE "merchants" RENAME COLUMN "webhook_secret" TO "webhook_secret_live";--> statement-breakpoint
DROP INDEX "paywalls_merchant_endpoint_uniq";--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "environment" "environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "webhook_url_test" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "webhook_secret_test" text;--> statement-breakpoint
ALTER TABLE "paywalls" ADD COLUMN "environment" "environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "environment" "environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "environment" "environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_merchant_env_active_idx" ON "api_keys" USING btree ("merchant_id","environment","is_active") WHERE "api_keys"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "paywalls_merchant_env_endpoint_uniq" ON "paywalls" USING btree ("merchant_id","environment","endpoint_pattern");--> statement-breakpoint
CREATE INDEX "transactions_merchant_env_created_idx" ON "transactions" USING btree ("merchant_id","environment","created_at");--> statement-breakpoint
CREATE INDEX "transactions_api_key_id_idx" ON "transactions" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_merchant_env_status_retry_idx" ON "webhook_deliveries" USING btree ("merchant_id","environment","status","next_retry_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_tx_environment_matches_key()
RETURNS TRIGGER AS $$
DECLARE
  key_env text;
BEGIN
  IF NEW.api_key_id IS NULL THEN
    -- Pre-S2 transactions backfilled from the live keyspace; allow null lineage.
    -- All new transactions emitted by post-S2 code paths must set api_key_id.
    RETURN NEW;
  END IF;
  SELECT environment::text INTO key_env FROM api_keys WHERE id = NEW.api_key_id;
  IF key_env IS NULL THEN
    RAISE EXCEPTION 'api_key_id % does not exist', NEW.api_key_id;
  END IF;
  IF key_env <> NEW.environment::text THEN
    RAISE EXCEPTION 'transaction environment % does not match api_key environment % for api_key %',
      NEW.environment, key_env, NEW.api_key_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER tx_environment_match_check
BEFORE INSERT OR UPDATE OF environment, api_key_id ON transactions
FOR EACH ROW EXECUTE FUNCTION enforce_tx_environment_matches_key();