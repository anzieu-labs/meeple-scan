-- Trigram matching for typo-tolerant game name search (available on Neon).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "game_names" (
	"bgg_id" integer NOT NULL,
	"name" text NOT NULL,
	"normalized" text NOT NULL,
	"is_primary" boolean NOT NULL,
	"is_expansion" boolean DEFAULT false NOT NULL,
	"rank" integer,
	"users_rated" integer DEFAULT 0 NOT NULL,
	"year_published" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_names_bgg_id_normalized_pk" PRIMARY KEY("bgg_id","normalized")
);
--> statement-breakpoint
CREATE INDEX "game_names_normalized_trgm" ON "game_names" USING gin ("normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "game_names_rank_index" ON "game_names" USING btree ("rank");