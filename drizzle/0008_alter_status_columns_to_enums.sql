ALTER TABLE "marketing_subscribers" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."subscriber_status";--> statement-breakpoint
ALTER TABLE "marketing_subscribers" ALTER COLUMN "status" SET DATA TYPE "public"."subscriber_status" USING "status"::"public"."subscriber_status";--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."secret_status";--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "status" SET DATA TYPE "public"."secret_status" USING "status"::"public"."secret_status";
