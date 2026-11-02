import "server-only";

import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { gameNames } from "@/db/schema";
import { fetchGames, fetchHotIds, MAX_THING_IDS } from "@/lib/bgg/client";

import { upsertGames } from "./games";

/** Pause between BGG calls: the API has no published limit, so stay polite. */
const PAUSE_MS = 1000;

/**
 * Refreshes full details (ratings, players, alternate names…) for the `top` best-ranked games plus BGG's
 * hot list, 20 per call. Ranks come from our name index, i.e. the last imported BGG ranks dump.
 */
export async function refreshTopGames(top: number) {
  const started = Date.now();
  const ranked = await db
    .select({ bggId: gameNames.bggId })
    .from(gameNames)
    .where(and(eq(gameNames.isPrimary, true), isNotNull(gameNames.rank)))
    .orderBy(asc(gameNames.rank))
    .limit(top);
  const hot = await fetchHotIds();
  const refreshed = await refreshGames([...new Set([...ranked.map((r) => r.bggId), ...hot])]);
  return { ranked: ranked.length, hot: hot.length, refreshed, seconds: Math.round((Date.now() - started) / 1000) };
}

/**
 * Refreshes BGG's hot list (~50 games, 3 calls): new releases get into our name index the day they turn up,
 * long before BGG ranks them, so photos and searches find them.
 */
export async function refreshHotGames() {
  const started = Date.now();
  const hot = await fetchHotIds();
  const refreshed = await refreshGames(hot);
  return { hot: hot.length, refreshed, seconds: Math.round((Date.now() - started) / 1000) };
}

/** Fetches and stores these games' details (and their names in the index), 20 per BGG call. */
async function refreshGames(ids: number[]) {
  let refreshed = 0;
  for (let i = 0; i < ids.length; i += MAX_THING_IDS) {
    if (i) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    refreshed += (await upsertGames(await fetchGames(ids.slice(i, i + MAX_THING_IDS)))).length;
  }
  return refreshed;
}
