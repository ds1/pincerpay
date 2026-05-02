CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"merchant_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"client_ip" text,
	"client_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cli_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"label" text DEFAULT 'CLI' NOT NULL,
	"client_name" text,
	"client_ip_first" text,
	"client_ip_last" text,
	"scope" text DEFAULT 'merchant:* api-keys:*' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "cli_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "cli_sessions_revoked_reason_valid" CHECK ("cli_sessions"."revoked_reason" IS NULL OR "cli_sessions"."revoked_reason" IN ('user','admin','expired','compromised','auth_user_deleted'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_auth_user_id_created_at_idx" ON "audit_events" USING btree ("auth_user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_events_merchant_id_created_at_idx" ON "audit_events" USING btree ("merchant_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_events_event_type_idx" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "cli_sessions_token_hash_active_idx" ON "cli_sessions" USING btree ("token_hash") WHERE "cli_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "cli_sessions_auth_user_id_active_idx" ON "cli_sessions" USING btree ("auth_user_id") WHERE "cli_sessions"."revoked_at" IS NULL;