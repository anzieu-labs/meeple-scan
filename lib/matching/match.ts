import type { BggGame, BggSearchHit } from "@/lib/bgg/parse";

import type { MatchInput } from "./clean";
import { decide, rankCandidates, type RankedCandidate } from "./rank";

export interface BggSource {
  search(query: string, options: { exact: boolean }): Promise<BggSearchHit[]>;
  fetchGames(ids: number[]): Promise<BggGame[]>;
  /** Typo-tolerant search in our own name index (lib/game/name-index.ts), when available. */
  searchNames?(query: string): Promise<{ bggId: number }[]>;
}

export interface MatchResult {
  decision: "auto" | "guess" | "none";
  ranked: RankedCandidate[];
  queries: string[];
}

/** Details mostly come from our cache; BGG's limit per details call applies to the uncached rest. */
const MAX_CANDIDATES = 20;
/** Name-index hits kept per query: they survive misread letters, which BGG's own search doesn't. */
const NAME_INDEX_HITS = 8;

export interface MatchOptions {
  /** Publisher seen on the box, a weak hint matched against BGG publishers. */
  brand?: string | null;
}

/**
 * Finds the BGG game for ready-made search queries, preferring a best guess over nothing:
 * 1. typo-tolerant search in our name index (Postgres trigrams, every ranked game) for the top 2 queries
 *    ("oiticulture" -> Viticulture);
 * 2. exact BGG name search on each query until one hits: the only way to find games too new or too
 *    little played to be ranked, so not in the index.
 * BGG's fuzzy search isn't used: on the evaluation photos it added more wrong games than right ones.
 * Details come from the caller's cache (`fetchGames`), so a photo usually costs 1–3 BGG searches. If BGG
 * refuses (too many requests, down), whatever the index found is still ranked and shown.
 */
export async function matchQueries(
  input: MatchInput,
  bgg: BggSource,
  { brand = null }: MatchOptions = {},
): Promise<MatchResult> {
  const candidates = new Set<number>();
  // The index answers while BGG is searched.
  const indexing = Promise.all((bgg.searchNames ? input.queries.slice(0, 2) : []).map((q) => bgg.searchNames!(q))).then(
    (results) => results.flatMap((hits) => hits.slice(0, NAME_INDEX_HITS).map((hit) => hit.bggId)),
  );
  indexing.catch(() => {}); // Awaited below, after BGG.

  for (const query of input.queries) {
    try {
      for (const hit of await bgg.search(query, { exact: true })) candidates.add(hit.id);
    } catch (error) {
      // BGG's error only matters when there's nothing else to show.
      if (!candidates.size && !(await indexing).length) throw error;
      break;
    }
    if (candidates.size) break;
  }
  (await indexing).forEach((id) => candidates.add(id));

  const ids = [...candidates].slice(0, MAX_CANDIDATES);
  if (!ids.length) return { decision: "none", ranked: [], queries: input.queries };
  const ranked = rankCandidates(await bgg.fetchGames(ids), input, brand);
  return { decision: decide(ranked), ranked, queries: input.queries };
}
