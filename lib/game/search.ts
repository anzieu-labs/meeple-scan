import "server-only";

import { searchBgg } from "@/lib/bgg/client";
import { nameSimilarity } from "@/lib/matching/rank";

import { getGames } from "./games";
import { searchNameIndex } from "./name-index";
import type { GameCard } from "./types";

const RESULTS = 10;
/** Games whose details are looked up (one BGG call for the ones not cached). */
const SHORTLIST = 20;

/**
 * Manual search for the picker and "Wrong game": exact name matches first, then our name index
 * (typo-tolerant: "wingspam" finds Wingspan), then BGG's fuzzy matches for games not in the index. BGG returns
 * fuzzy results alphabetically, so everything is ranked here by name and popularity. If BGG fails, the index's
 * games are still shown.
 */
export async function searchGames(query: string): Promise<GameCard[]> {
  const [exact, fuzzy, indexed] = await Promise.allSettled([
    searchBgg(query, { exact: true }),
    searchBgg(query),
    searchNameIndex(query),
  ]);
  const exactIds = exact.status === "fulfilled" ? exact.value.map((h) => h.id) : [];
  const indexIds = indexed.status === "fulfilled" ? indexed.value.map((h) => h.bggId) : [];
  const fuzzyIds =
    fuzzy.status === "fulfilled"
      ? fuzzy.value
          .map((h) => ({ id: h.id, similarity: nameSimilarity(query, h.name) }))
          .sort((a, b) => b.similarity - a.similarity)
          .map((h) => h.id)
      : [];
  const shortlist = [...new Set([...exactIds, ...indexIds, ...fuzzyIds])].slice(0, SHORTLIST);
  if (!shortlist.length) {
    // Nothing found because a search failed, not because no game has that name.
    const failed = [exact, fuzzy, indexed].find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
    return [];
  }

  const exactSet = new Set(exactIds);
  const found = await getGames(shortlist);
  const popularity = (g: GameCard) => Math.min(1, Math.log10(g.usersRated + 1) / 5);
  return found
    .map((game) => ({
      game,
      score:
        (exactSet.has(game.bggId) ? 1 : 0) +
        0.75 * Math.max(nameSimilarity(query, game.name), ...game.alternateNames.map((n) => nameSimilarity(query, n))) +
        0.25 * popularity(game),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULTS)
    .map(({ game }) => game);
}
