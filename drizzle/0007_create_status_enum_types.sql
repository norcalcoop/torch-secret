CREATE TYPE "public"."secret_status" AS ENUM('active', 'viewed', 'expired', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('pending', 'confirmed', 'unsubscribed');
