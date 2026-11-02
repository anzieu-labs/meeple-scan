CREATE TYPE "public"."barcode_source" AS ENUM('upcitemdb', 'user');--> statement-breakpoint
CREATE TYPE "public"."barcode_status" AS ENUM('auto', 'confirmed', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."game_type" AS ENUM('boardgame', 'boardgameexpansion');--> statement-breakpoint
CREATE TABLE "api_quota" (
	"provider" text PRIMARY KEY NOT NULL,
	"remaining" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcodes" (
	"gtin" varchar(14) PRIMARY KEY NOT NULL,
	"bgg_id" integer,
	"status" "barcode_status" NOT NULL,
	"source" "barcode_source" NOT NULL,
	"upc_title" text,
	"upc_brand" text,
	"confidence" real,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"bgg_id" integer PRIMARY KEY NOT NULL,
	"type" "game_type" NOT NULL,
	"name" text NOT NULL,
	"alternate_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"year_published" integer,
	"thumbnail" text,
	"image" text,
	"rating_average" real,
	"rating_bayes" real,
	"users_rated" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"weight" real,
	"num_weights" integer DEFAULT 0 NOT NULL,
	"min_players" integer,
	"max_players" integer,
	"best_players" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"recommended_players" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"min_age" integer,
	"community_age" integer,
	"min_play_time" integer,
	"max_play_time" integer,
	"mechanics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publishers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_votes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"gtin" varchar(14) NOT NULL,
	"bgg_id" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_votes_clientId_gtin_unique" UNIQUE("client_id","gtin")
);
--> statement-breakpoint
ALTER TABLE "barcodes" ADD CONSTRAINT "barcodes_bgg_id_games_bgg_id_fk" FOREIGN KEY ("bgg_id") REFERENCES "public"."games"("bgg_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_gtin_barcodes_gtin_fk" FOREIGN KEY ("gtin") REFERENCES "public"."barcodes"("gtin") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_bgg_id_games_bgg_id_fk" FOREIGN KEY ("bgg_id") REFERENCES "public"."games"("bgg_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barcodes_bgg_id_index" ON "barcodes" USING btree ("bgg_id");--> statement-breakpoint
CREATE INDEX "match_votes_gtin_index" ON "match_votes" USING btree ("gtin");