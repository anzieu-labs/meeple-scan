import { matchQueries, type BggSource, type MatchResult } from "./match";
import { normalizeName } from "./rank";

/** A game a vision model saw on the photo: its title as printed, and its name on BoardGameGeek. */
export interface VisionGame {
  printed: string;
  bgg: string;
}

/**
 * Another game on the photo only counts when its name matches this well; below that it's usually a near
 * name that happens to be a game. Same bar as an automatic match.
 */
const MIN_EXTRA_NAME_SCORE = 0.85;

/**
 * Called with each game of a photo as soon as it's matched, the main one first: the phone shows them one by
 * one. `more`: other games on the photo are still to be looked up.
 */
export type OnMatch = (match: MatchResult, more: boolean) => void | Promise<void>;

export interface PhotoMatch {
  /** The biggest or most central box. */
  main: MatchResult;
  /** Other games found on the same photo, never repeating a game. */
  extras: MatchResult[];
  /** The main title as printed, for "Read on the box: …". */
  text: string[];
}

/**
 * The games a vision model named on a photo, matched by BGG name first, then by the title as printed (a box
 * in Polish is still Wingspan). Null when the first game matches nothing. Every game named is looked up, one
 * at a time (BGG answers 429 to bursts); extras are a bonus: if BGG refuses one, the games already found are
 * kept, and they never repeat a game.
 */
export async function matchVisionGames(
  games: VisionGame[],
  bgg: BggSource,
  onMatch?: OnMatch,
): Promise<PhotoMatch | null> {
  // Not cleanTitle: that drops words like "card game" or "edition", which are part of these names.
  const queriesOf = (g: VisionGame) => [...new Set([g.bgg, g.printed].map(normalizeName).filter(Boolean))];
  const titles = games.map((g) => `${g.printed} ${g.bgg}`);
  const one = (queries: string[]) => matchQueries({ queries, phrases: queries.map((phrase) => ({ phrase, score: 1 })), titles }, bgg);

  const named = games.filter((g) => queriesOf(g).length);
  if (!named.length) return null;
  const main = await one(queriesOf(named[0]));
  if (main.decision === "none") return null;
  const others = named.slice(1);
  await onMatch?.(main, others.length > 0);

  const seen = new Set([main.ranked[0].game.bggId]);
  const extras: MatchResult[] = [];
  for (const [i, game] of others.entries()) {
    let extra: MatchResult;
    try {
      extra = await one(queriesOf(game));
    } catch (error) {
      console.warn("Stopped matching other games on the photo", error);
      break;
    }
    const top = extra.ranked[0];
    if (extra.decision === "none" || !top || top.nameScore < MIN_EXTRA_NAME_SCORE || seen.has(top.game.bggId)) continue;
    seen.add(top.game.bggId);
    extras.push(extra);
    await onMatch?.(extra, i < others.length - 1);
  }
  return { main, extras, text: [named[0].printed] };
}
