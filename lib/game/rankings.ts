import "server-only";

import { and, asc, eq, isNotNull } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { db } from "@/db";
import { gameNames } from "@/db/schema";
import { fetchHotIds } from "@/lib/bgg/client";

import { getGames } from "./games";
import type { GameCard } from "./types";

/** Games in the "Top ranked" list. */
const TOP = 100;

/**
 * BGG's hot list: the ~50 games most looked at on BoardGameGeek right now. Cached for an hour, so BGG is
 * asked at most once an hour whoever opens the tab.
 */
export async function getHotGames(): Promise<GameCard[]> {
  "use cache";
  cacheLife("hours");
  return getGames(await fetchHotIds());
}

/** BGG's best-ranked games, from the ranks in our name index (the weekly import). */
export async function getTopGames(): Promise<GameCard[]> {
  "use cache";
  cacheLife("hours");
  const ranked = await db
    .select({ bggId: gameNames.bggId })
    .from(gameNames)
    .where(and(eq(gameNames.isPrimary, true), isNotNull(gameNames.rank)))
    .orderBy(asc(gameNames.rank))
    .limit(TOP);
  return getGames(ranked.map((r) => r.bggId));
}
