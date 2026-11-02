import type { games } from "@/db/schema";

/** A game as stored in our BGG cache and sent to the phone. */
export type GameCard = typeof games.$inferSelect;

/** One game found on a photo, with its alternatives for "Not this game?". */
export interface CoverGame {
  game: GameCard;
  /** auto: clear match · guess: best candidate, unsure. */
  match: "auto" | "guess";
  alternatives: GameCard[];
}

/**
 * What `POST /api/cover` answers for a photo: every game found on it (the biggest title first, then
 * other boxes in the same shot), and `text`, the main title as read.
 */
export type CoverResult =
  | { status: "matched"; games: CoverGame[]; text: string[]; logId: string }
  | { status: "not_found"; text: string[]; logId: string }
  /** `ocr`: the box reader is down. `bgg`: BoardGameGeek refused (usually too many requests). */
  | { status: "unavailable"; service: "ocr" | "bgg" };

/**
 * What `POST /api/cover` streams, one JSON object per line: each game as soon as it's found (`more`: other
 * titles are still being looked up), then the result; `error` if the lookup broke.
 */
export type CoverEvent =
  | { type: "game"; game: CoverGame; more: boolean; logId: string }
  | { type: "done"; result: CoverResult }
  | { type: "error" };
