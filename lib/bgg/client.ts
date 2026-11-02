import "server-only";

import { parseHot, parseSearch, parseThings, type BggGame, type BggSearchHit } from "./parse";

const BASE_URL = "https://boardgamegeek.com/xmlapi2";
/** BGG's documented limit per `thing` request. */
export const MAX_THING_IDS = 20;
const RETRY_STATUSES = new Set([202, 429, 500, 502, 503]);
const MAX_ATTEMPTS = 4;

export class BggError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * GET against the XML API with the app's bearer token. Retries "queued" (202) and throttling responses
 * with exponential backoff (1s, 2s, 4s), honouring Retry-After when BGG sends it.
 */
async function bggGet(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new BggError("BGG_API_TOKEN is not set");
  const url = `${BASE_URL}/${path}?${new URLSearchParams(params)}`;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
    if (res.ok && res.status !== 202) return res.text();
    if (!RETRY_STATUSES.has(res.status) || attempt >= MAX_ATTEMPTS) {
      throw new BggError(`BGG ${path} failed with ${res.status}`, res.status);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 10_000)));
  }
}

/** Searches base games and expansions by name; `exact` matches whole primary or alternate names. */
export async function searchBgg(query: string, { exact = false, signal }: { exact?: boolean; signal?: AbortSignal } = {}): Promise<BggSearchHit[]> {
  const params: Record<string, string> = { query, type: "boardgame,boardgameexpansion" };
  if (exact) params.exact = "1";
  return parseSearch(await bggGet("search", params, signal));
}

/** The ~50 board games trending on BGG right now (new releases show up here before they get a rank). */
export async function fetchHotIds(signal?: AbortSignal): Promise<number[]> {
  return parseHot(await bggGet("hot", { type: "boardgame" }, signal));
}

/** Full game data with ratings, for up to 20 ids per call. */
export async function fetchGames(ids: number[], signal?: AbortSignal): Promise<BggGame[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  if (unique.length > MAX_THING_IDS) throw new BggError(`At most ${MAX_THING_IDS} ids per request`);
  return parseThings(await bggGet("thing", { id: unique.join(","), stats: "1" }, signal));
}
