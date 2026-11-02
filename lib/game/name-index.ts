import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { gameNames } from "@/db/schema";
import { normalizeName } from "@/lib/matching/rank";

import type { GameCard } from "./types";

/**
 * pg_trgm's default. Keeps one-letter misreads ("oiticulture" 0.75, "arcassonne" 0.82); lower also lets in
 * half-matching side lines ("next move" -> NEXT at 0.5) along with rarer misreads ("decrppto", 0.5).
 */
const WORD_SIMILARITY = 0.6;
/** For names compared without spaces: "forsale" is For Sale (1.0), and Skytear (0.6) only just. */
const SQUASHED_SIMILARITY = 0.6;

/**
 * Typo-tolerant search in our own index of ~40k BGG names: the query is compared with the
 * best-matching run of words in each name, so "oiticulture" finds Viticulture and "arcassonne"
 * finds Carcassonne. Best match first, more-rated games first on ties. "Best" adds whole-name similarity:
 * word_similarity alone rates "arcassonne" higher in "carcassonne amazonas" (the next word's first letter
 * counts as a match) than in "carcassonne" itself. Names are also compared without spaces, since OCR often
 * runs big letters together: "forsale" finds For Sale, "skyteam" Sky Team.
 */
export async function searchNameIndex(
  query: string,
  limit = 8,
): Promise<{ bggId: number; name: string; similarity: number }[]> {
  const q = normalizeName(query);
  if (q.replace(/\s/g, "").length < 3) return [];
  const squashed = q.replace(/ /g, "");
  return db.transaction(async (tx) => {
    // The planner expects trigram matches to return much of the table and scans all 68k names (~300 ms);
    // the two trigram indexes answer in ~10 ms. Settings last until the end of this transaction.
    await tx.execute(sql`select set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY)}, true),
                                set_config('pg_trgm.similarity_threshold', ${String(SQUASHED_SIMILARITY)}, true),
                                set_config('enable_seqscan', 'off', true)`);
    const spaced = sql`word_similarity(${q}, normalized) + similarity(${q}, normalized)`;
    const merged = sql`2 * similarity(${squashed}, replace(normalized, ' ', ''))`;
    const { rows } = await tx.execute<{ bgg_id: number; name: string; similarity: number }>(sql`
      select bgg_id, (array_agg(name order by is_primary desc))[1] as name,
             max(greatest(word_similarity(${q}, normalized), similarity(${squashed}, replace(normalized, ' ', '')))) as similarity
      from ${gameNames}
      where ${q} <% normalized or ${squashed} % replace(normalized, ' ', '')
      group by bgg_id
      order by max(greatest(${spaced}, ${merged})) desc, max(users_rated) desc
      limit ${limit}`);
    return rows.map((r) => ({ bggId: r.bgg_id, name: r.name, similarity: Number(r.similarity) }));
  });
}

/** Adds a game's primary and alternate names (other languages, editions) to the index. */
export async function indexGameNames(games: GameCard[]) {
  const rows = games.flatMap((game) =>
    [game.name, ...game.alternateNames]
      .map((name, i) => ({ name, normalized: normalizeName(name), isPrimary: i === 0 }))
      .filter((n, i, all) => n.normalized && all.findIndex((m) => m.normalized === n.normalized) === i)
      .map((n) => ({
        bggId: game.bggId,
        ...n,
        isExpansion: game.type === "boardgameexpansion",
        rank: game.rank,
        usersRated: game.usersRated,
        yearPublished: game.yearPublished,
      })),
  );
  if (!rows.length) return;
  await db
    .insert(gameNames)
    .values(rows)
    .onConflictDoUpdate({
      target: [gameNames.bggId, gameNames.normalized],
      set: {
        isPrimary: sql`${gameNames.isPrimary} or excluded.is_primary`,
        rank: sql`excluded.rank`,
        usersRated: sql`excluded.users_rated`,
        updatedAt: sql`now()`,
      },
    });
}
