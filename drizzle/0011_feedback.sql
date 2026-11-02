CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message" text NOT NULL,
	"email" text,
	"locale" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_created_at_index" ON "feedback" USING btree ("created_at");