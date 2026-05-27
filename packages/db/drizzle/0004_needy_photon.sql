ALTER TABLE "api_keys" ALTER COLUMN "key_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "key_hash_hmac" text;--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_hmac_idx" ON "api_keys" USING btree ("key_hash_hmac");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_key_hash_hmac_unique" UNIQUE("key_hash_hmac");