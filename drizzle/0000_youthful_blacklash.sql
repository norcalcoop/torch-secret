CREATE TABLE "secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"password_hash" text,
	"password_attempts" integer DEFAULT 0 NOT NULL
);
