ALTER TABLE "secrets" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "notify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "viewed_at" timestamp with time zone;