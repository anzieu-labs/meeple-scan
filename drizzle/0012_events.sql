CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"visit" uuid NOT NULL,
	"locale" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_created_at_index" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_name_created_at_index" ON "events" USING btree ("name","created_at");