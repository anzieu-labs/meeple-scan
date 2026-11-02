-- Uncertain matches now show their best candidate instead of a picker: rename the status in place
-- and point existing rows at their top candidate.
ALTER TYPE "public"."barcode_status" RENAME VALUE 'ambiguous' TO 'guess';--> statement-breakpoint
UPDATE "barcodes" SET "bgg_id" = "candidate_ids"[1] WHERE "status" = 'guess' AND "bgg_id" IS NULL AND cardinality("candidate_ids") > 0;
