import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { PlayerVotes } from "@/lib/bgg/parse";
import type { EventName, EventProps } from "@/lib/events/names";
import type { OcrLine } from "@/lib/matching/cover";
import type { VisionGame } from "@/lib/matching/vision-match";

const updatedAt = () =>
  timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const gameType = pgEnum("game_type", ["boardgame", "boardgameexpansion"]);

/** BGG data cache; the weekly cron refreshes the top games, anything older than a week is refetched when shown. */
export const games = pgTable("games", {
  bggId: integer().primaryKey(),
  type: gameType().notNull(),
  name: text().notNull(),
  alternateNames: jsonb().$type<string[]>().notNull().default([]),
  yearPublished: integer(),
  thumbnail: text(),
  image: text(),
  /** Null when BGG reports 0 (no data). */
  ratingAverage: real(),
  ratingBayes: real(),
  usersRated: integer().notNull().default(0),
  rank: integer(),
  weight: real(),
  numWeights: integer().notNull().default(0),
  minPlayers: integer(),
  maxPlayers: integer(),
  bestPlayers: integer().array().notNull().default(sql`'{}'::integer[]`),
  recommendedPlayers: integer().array().notNull().default(sql`'{}'::integer[]`),
  /** The player-count poll, count by count (lib/bgg/parse.ts); empty until the game is next refreshed. */
  playerVotes: jsonb().$type<PlayerVotes[]>().notNull().default([]),
  minAge: integer(),
  communityAge: integer(),
  minPlayTime: integer(),
  maxPlayTime: integer(),
  mechanics: jsonb().$type<string[]>().notNull().default([]),
  categories: jsonb().$type<string[]>().notNull().default([]),
  publishers: jsonb().$type<string[]>().notNull().default([]),
  fetchedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * Local name index of BGG games for typo-tolerant search (pg_trgm), so misread text like "oiticulture"
 * still finds Viticulture. Primary names come from BGG's ranks dump (scripts/import-ranks.ts); alternate
 * names (other languages) are added when a game's details are fetched.
 */
export const gameNames = pgTable(
  "game_names",
  {
    bggId: integer().notNull(),
    name: text().notNull(),
    /** lib/matching/rank.ts normalizeName(): what searches compare against. */
    normalized: text().notNull(),
    isPrimary: boolean().notNull(),
    isExpansion: boolean().notNull().default(false),
    rank: integer(),
    usersRated: integer().notNull().default(0),
    yearPublished: integer(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.bggId, t.normalized] }),
    index("game_names_normalized_trgm").using("gin", sql`${t.normalized} gin_trgm_ops`),
    // Names without spaces, for OCR that runs words together (lib/game/name-index.ts).
    index("game_names_squashed_trgm").using("gin", sql`replace(${t.normalized}, ' ', '') gin_trgm_ops`),
    index().on(t.rank),
  ],
);

/** A game the user picked after a photo: instead of `from`, or as a game that wasn't found (`from: null`). */
export interface PhotoCorrection {
  from: number | null;
  to: number;
  via: "alternative" | "search";
  at: string;
}

/**
 * One row per photo read: the text OCR found (never the image), the games shown, the ones the user marked
 * right, and what they picked instead or added as missed. That makes these labelled examples for tuning the
 * matcher (scripts/export-photo-logs.ts). No IP or device id is kept.
 */
export const photoLogs = pgTable(
  "photo_logs",
  {
    id: uuid().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lines: jsonb().$type<OcrLine[]>().notNull(),
    /** The games Gemini named on the photo; null when it wasn't asked or didn't answer. */
    vision: jsonb().$type<VisionGame[]>(),
    /** Which reading the games shown come from: Gemini's names, or OCR when Gemini matched nothing. */
    source: text().$type<"gemini" | "ocr">(),
    /** Main game first, then the other boxes on the photo. */
    shown: jsonb().$type<{ bggId: number; match: "auto" | "guess" }[]>().notNull(),
    /** `from: null`: a game on the photo that wasn't found (nothing found, or missed among several boxes). */
    corrections: jsonb().$type<PhotoCorrection[]>().notNull().default([]),
    /** Shown games the user marked as the right game. */
    confirmed: integer().array().notNull().default(sql`'{}'::integer[]`),
  },
  (t) => [index().on(t.createdAt)],
);

/**
 * Messages sent from the Settings tab: a bug, a game not recognised, an idea. The email is there only when
 * the sender wants an answer; nothing else about them is kept.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    message: text().notNull(),
    email: text(),
    /** The app's language when it was sent, to read it (and answer) in that language. */
    locale: text().notNull(),
  },
  (t) => [index().on(t.createdAt)],
);

/**
 * Usage events (lib/events/names.ts): visits, where they came from, photos taken, installs. Nothing that
 * identifies a person or a device: `visit` is a random id for one page load, kept in memory on the page.
 */
export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    name: text().$type<EventName>().notNull(),
    visit: uuid().notNull(),
    locale: text().notNull(),
    props: jsonb().$type<EventProps>().notNull().default({}),
  },
  (t) => [index().on(t.createdAt), index().on(t.name, t.createdAt)],
);
