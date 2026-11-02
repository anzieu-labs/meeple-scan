import "server-only";

import { getTableColumns, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { games } from "@/db/schema";
import { fetchGames, MAX_THING_IDS } from "@/lib/bgg/client";
import type { BggGame } from "@/lib/bgg/parse";

import { indexGameNames } from "./name-index";
import type { GameCard } from "./types";

/** The weekly cron refreshes the top games; anything older is refreshed when shown. */
const GAME_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Inserts or refreshes BGG data (and its names in the search index), returning the stored rows. */
export async function upsertGames(rows: BggGame[]): Promise<GameCard[]> {
  if (!rows.length) return [];
  const { bggId, fetchedAt, ...columns } = getTableColumns(games);
  // Column keys are camelCase; the database names come from the `snake_case` casing in db/index.ts.
  const set = Object.fromEntries(
    Object.keys(columns).map((key) => [key, sql.raw(`excluded."${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}"`)]),
  );
  const stored = await db
    .insert(games)
    .values(rows)
    .onConflictDoUpdate({ target: games.bggId, set: { ...set, fetchedAt: sql`now()` } })
    .returning();
  await indexGameNames(stored);
  return stored;
}

/**
 * Games by BGG id, in the order asked. Missing or week-old rows are fetched from BGG, 20 per call (one call
 * for a photo; a few for a ranking list); if BGG is down, stale rows are still returned rather than failing.
 */
export async function getGames(ids: number[]): Promise<GameCard[]> {
  if (!ids.length) return [];
  const cached = await db.select().from(games).where(inArray(games.bggId, ids));
  const byId = new Map(cached.map((g) => [g.bggId, g]));
  const stale = ids.filter((id) => {
    const game = byId.get(id);
    // Cached before the player-count poll was kept: fetched again for its chart.
    const withoutPoll = game && game.bestPlayers.length > 0 && game.playerVotes.length === 0;
    return !game || withoutPoll || Date.now() - game.fetchedAt.getTime() > GAME_TTL_MS;
  });

  if (stale.length) {
    try {
      for (let i = 0; i < stale.length; i += MAX_THING_IDS) {
        for (const game of await upsertGames(await fetchGames(stale.slice(i, i + MAX_THING_IDS)))) byId.set(game.bggId, game);
      }
    } catch (error) {
      if (stale.every((id) => !byId.has(id))) throw error;
      console.warn("BGG refresh failed, serving cached games", error);
    }
  }
  return ids.map((id) => byId.get(id)).filter((g): g is GameCard => Boolean(g));
}
