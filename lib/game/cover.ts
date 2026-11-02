import "server-only";

import { after } from "next/server";

import { BggError, searchBgg } from "@/lib/bgg/client";
import { geminiEnabled, readGameNames } from "@/lib/gemini/client";
import { matchCover, type CoverMatch } from "@/lib/matching/cover-match";
import type { BggSource, MatchResult } from "@/lib/matching/match";
import { matchVisionGames, type VisionGame } from "@/lib/matching/vision-match";
import { OcrError, readCover } from "@/lib/ocr/client";

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

/** Gemini's answer, or null when it's off, down or too slow: OCR alone is used then. */
async function askGemini(image: ArrayBuffer, contentType: string): Promise<VisionGame[] | null> {
  if (!geminiEnabled()) return null;
  try {
    return await readGameNames(image, contentType);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Photo -> games. Gemini and OCR on the VPS read the photo at the same time. The games Gemini names are
 * matched first (it reads stylized and foreign titles OCR can't, and knows their BGG names); when it names
 * nothing that matches, the biggest OCR titles are (several boxes in one shot). Both match against our name
 * index, then exact BGG search for games too new to be in it. Game details come from the shared cache.
 * `onGame` gets each game as soon as it's found, the main one first, so the phone can show them one by one.
 */
export async function recognizeCover(
  image: ArrayBuffer,
  contentType: string,
  onGame?: (game: CoverGame, more: boolean, logId: string) => void | Promise<void>,
): Promise<CoverResult> {
  // The id lets the phone attach what the user confirms or picks instead; the row is written at the end.
  const logId = crypto.randomUUID();
  const games: CoverGame[] = [];
  const onMatch = async (match: MatchResult, more: boolean) => {
    const game = await toCoverGame(match);
    if (!game) return;
    games.push(game);
    await onGame?.(game, more, logId);
  };
  const ocr = readCover(image, contentType);
  ocr.catch(() => {}); // Awaited below or in the log; Gemini may answer first.
  const vision = await askGemini(image, contentType);

  let found: CoverMatch | null;
  let source: "gemini" | "ocr" = "gemini";
  try {
    found = vision?.length ? await matchVisionGames(vision, bgg, onMatch) : null;
    if (!found) {
      source = "ocr";
      let lines;
      try {
        ({ lines } = await ocr);
      } catch (error) {
        if (error instanceof OcrError) {
          console.error(error);
          return { status: "unavailable", service: "ocr" };
        }
        throw error;
      }
      found = await matchCover(lines, bgg, onMatch);
    }
  } catch (error) {
    if (error instanceof BggError) {
      console.error("BGG matching failed", error);
      return { status: "unavailable", service: "bgg" };
    }
    throw error;
  }

  // Logged once the answer is sent (and OCR is done).
  after(async () => {
    const lines = await ocr.then((r) => r.lines, () => []);
    await logPhoto(logId, { lines, vision, source }, games);
  });
  return games.length
    ? { status: "matched", games, text: found.text, logId }
    : { status: "not_found", text: found.text, logId };
}
