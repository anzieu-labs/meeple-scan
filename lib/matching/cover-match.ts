import type { BggGame } from "@/lib/bgg/parse";

import type { MatchInput } from "./clean";
import { coverMatchInput, extraTitleInputs, type OcrLine } from "./cover";
import { matchQueries, type BggSource, type MatchResult } from "./match";
import { normalizeName } from "./rank";

/**
 * An extra title only counts as another game when its name matches this well; below that it's usually a
 * subtitle, tagline or designer name of the main box ("THE GAME", "ESSENTIAL EDITION"), or a near-word
 * that happens to be a game ("SPIELE" -> Spiel). Same bar as an automatic match.
 */
export const MIN_EXTRA_NAME_SCORE = 0.85;

/**
 * Called with each game of a photo as soon as it's matched, the main one first: the phone shows them one by
 * one. `more`: other titles on the photo are still to be looked up.
 */
export type OnMatch = (match: MatchResult, more: boolean) => void | Promise<void>;

export interface CoverMatch {
  /** The game behind the biggest title. */
  main: MatchResult;
  /** Other games found on the same photo, biggest title first, never repeating a game. */
  extras: MatchResult[];
  /** The main title as read, for "Read on the box: …". */
  text: string[];
}

const words = (name: string) => normalizeName(name).split(" ").filter(Boolean);

/**
 * A series name printed smaller than this (compared with the main title) is part of the main box; as big,
 * it's another box: Azul next to Azul: Queen's Garden on a shelf.
 */
const SERIES_NAME_SIZE = 0.6;

/**
 * Text from the main box itself rather than another box: a smaller game name that is just part of the
 * main game's name ("Dice Masters" on Marvel Dice Masters: Avengers vs. X-Men), or the main game's
 * publisher logo ("Rio Grande" on Dominion).
 */
function partOfMainBox(extra: BggGame, input: MatchInput, main: BggGame | undefined) {
  if (!main) return false;
  const mainWords = new Set(words(main.name));
  const smaller = (input.relativeSize ?? 1) < SERIES_NAME_SIZE;
  if (smaller && words(extra.name).every((w) => mainWords.has(w))) return true;
  const publishers = (main.publishers ?? []).map(normalizeName);
  return input.queries.some((text) => {
    const read = normalizeName(text);
    return read.length >= 3 && publishers.some((p) => p === read || p.startsWith(`${read} `));
  });
}

/**
 * Finds every game on a photo: the main title, then other big titles one at a time (BGG answers 429 to
 * bursts). Extras are a bonus: if BGG refuses one, the games already found are kept. Text from the main
 * box (its series name, its publisher) never counts as another game.
 */
export async function matchCover(lines: OcrLine[], bgg: BggSource, onMatch?: OnMatch): Promise<CoverMatch> {
  const input = coverMatchInput(lines);
  const text = input.queries.slice(0, 2);
  if (!input.queries.length) return { main: { decision: "none", ranked: [], queries: [] }, extras: [], text };

  const main = await matchQueries(input, bgg);
  const mainGame = main.decision === "none" ? undefined : main.ranked[0]?.game;
  const others = extraTitleInputs(lines);
  if (mainGame) await onMatch?.(main, others.length > 0);
  const seen = new Set(main.ranked.slice(0, 1).map((c) => c.game.bggId));
  const extras: MatchResult[] = [];
  for (const [i, extra] of others.entries()) {
    let result: MatchResult;
    try {
      result = await matchQueries(extra, bgg);
    } catch (error) {
      console.warn("Stopped matching other titles on the photo", error);
      break;
    }
    const top = result.ranked[0];
    if (result.decision === "none" || !top || top.nameScore < MIN_EXTRA_NAME_SCORE || seen.has(top.game.bggId)) continue;
    if (partOfMainBox(top.game, extra, mainGame)) continue;
    seen.add(top.game.bggId);
    extras.push(result);
    await onMatch?.(result, i < others.length - 1);
  }
  return { main, extras, text };
}
