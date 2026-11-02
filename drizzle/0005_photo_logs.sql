CREATE TABLE "photo_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lines" jsonb NOT NULL,
	"shown" jsonb NOT NULL,
	"corrections" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "photo_logs_created_at_index" ON "photo_logs" USING btree ("created_at");