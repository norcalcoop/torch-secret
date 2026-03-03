CREATE TABLE "marketing_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmation_token" text,
	"token_expires_at" timestamp with time zone,
	"unsubscribe_token" text,
	"consent_text" text NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "marketing_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE INDEX "marketing_subscribers_confirmation_token_idx" ON "marketing_subscribers" USING btree ("confirmation_token");--> statement-breakpoint
CREATE INDEX "marketing_subscribers_unsubscribe_token_idx" ON "marketing_subscribers" USING btree ("unsubscribe_token");