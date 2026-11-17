import "server-only";

import { after } from "next/server";

import { BggError, searchBgg } from "@/lib/bgg/client";
import { GeminiError, readGameNames } from "@/lib/gemini/client";
import type { BggSource, MatchResult } from "@/lib/matching/match";
import { matchVisionGames, type PhotoMatch, type VisionGame } from "@/lib/matching/vision-match";

import { getGames } from "./games";
import { searchNameIndex } from "./name-index";
import { logPhoto } from "./photo-log";
import type { CoverGame, CoverResult } from "./types";

/** Each game plus up to 5 alternatives for "Not this game?". */
const CANDIDATES_KEPT = 6;

const bgg: BggSource = {
  search: (q, { exact }) => searchBgg(q, { exact }),
  fetchGames: getGames,
  searchNames: (q) => searchNameIndex(q),
};

/** A match's candidates (already in the BGG cache) as a card + alternatives. */
async function toCoverGame(match: MatchResult): Promise<CoverGame | null> {
  const [game, ...alternatives] = await getGames(match.ranked.slice(0, CANDIDATES_KEPT).map((c) => c.game.bggId));
  return game && match.decision !== "none" ? { game, match: match.decision, alternatives } : null;
}

/**
 * Photo -> games. Gemini names each game it sees (title as printed and BoardGameGeek name, the biggest box
 * first); they're matched against our name index, then exact BGG search for games too new to be in it.
 * Game details come from the shared cache. `onGame` gets each game as soon as it's found, the main one
 * first, so the phone can show them one by one.
 */
export async function recognizeCover(
  image: ArrayBuffer,
  contentType: string,
  onGame?: (game: CoverGame, more: boolean, logId: string) => void | Promise<void>,
): Promise<CoverResult> {
  let vision: VisionGame[];
  try {
    vision = await readGameNames(image, contentType);
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error(error);
      return { status: "unavailable", service: "reader" };
    }
    throw error;
  }

  // The id lets the phone attach what the user confirms or picks instead; the row is written at the end.
  const logId = crypto.randomUUID();
  const games: CoverGame[] = [];
  let found: PhotoMatch | null;
  try {
    found = await matchVisionGames(vision, bgg, async (match, more) => {
      const game = await toCoverGame(match);
      if (!game) return;
      games.push(game);
      await onGame?.(game, more, logId);
    });
  } catch (error) {
    if (error instanceof BggError) {
      console.error("BGG matching failed", error);
      return { status: "unavailable", service: "bgg" };
    }
    throw error;
  }

  after(() => logPhoto(logId, vision, games));
  const text = found?.text ?? vision.slice(0, 1).map((g) => g.printed);
  return games.length ? { status: "matched", games, text, logId } : { status: "not_found", text, logId };
}
