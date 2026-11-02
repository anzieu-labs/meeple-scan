ALTER TYPE "public"."barcode_status" ADD VALUE 'ambiguous' BEFORE 'not_found';--> statement-breakpoint
ALTER TABLE "barcodes" ADD COLUMN "candidate_ids" integer[] DEFAULT '{}'::integer[] NOT NULL;