ALTER TABLE "secrets" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "secrets_user_id_created_at_idx" ON "secrets" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "secrets"."user_id" IS NOT NULL;
