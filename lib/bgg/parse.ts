import { decodeHTML } from "entities";
import { XMLParser } from "fast-xml-parser";

import type { games } from "@/db/schema";

export type BggGame = Omit<typeof games.$inferInsert, "fetchedAt">;

export interface BggSearchHit {
  id: number;
  type: "boardgame" | "boardgameexpansion";
  /** The name that matched, primary or alternate. */
  name: string;
  year: number | null;
}

// Elements that must always parse as arrays, even when BGG returns a single one.
const ARRAYS = new Set([
  "items.item",
  "items.item.name",
  "items.item.link",
  "items.item.poll",
  "items.item.poll.results",
  "items.item.poll.results.result",
  "items.item.poll-summary",
  "items.item.poll-summary.result",
  "items.item.statistics.ratings.ranks.rank",
]);

// Values stay strings ("Not Ranked", "4+", numeric-looking titles) and are converted explicitly below.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  htmlEntities: true,
  isArray: (_name, jpath) => ARRAYS.has(String(jpath)),
});

type Attr = { value?: string } | undefined;
type XmlItem = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
/** BGG uses 0 for "no data" on ratings, weights and ages. */
const positive = (v: unknown) => {
  const n = num(v);
  return n && n > 0 ? n : null;
};
const attr = (node: Attr) => node?.value;
const int = (v: unknown) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

const MIN_POLL_VOTES = 20;
const MIN_VOTES_PER_COUNT = 10;

/** One player count's votes in BGG's "suggested number of players" poll. */
export interface PlayerVotes {
  players: number;
  best: number;
  recommended: number;
  notRecommended: number;
}

/**
 * Best and recommended player counts from the community poll, and the votes for each count (the counts
 * enough people voted on), or empty when too few people voted.
 */
export function playerPoll(item: XmlItem): { best: number[]; recommended: number[]; votes: PlayerVotes[] } {
  const poll = (item.poll ?? []).find((p: XmlItem) => p.name === "suggested_numplayers");
  if (!poll || Number(poll.totalvotes) < MIN_POLL_VOTES) return { best: [], recommended: [], votes: [] };

  const rows = (poll.results ?? [])
    .filter((r: XmlItem) => !String(r.numplayers).endsWith("+")) // "4+" means "more than the box says"
    .map((r: XmlItem) => {
      const votes = Object.fromEntries((r.result ?? []).map((x: XmlItem) => [x.value, Number(x.numvotes)]));
      return {
        players: Number(r.numplayers),
        best: votes.Best ?? 0,
        recommended: votes.Recommended ?? 0,
        notRecommended: votes["Not Recommended"] ?? 0,
      };
    })
    .filter((r: { best: number; recommended: number; notRecommended: number }) => r.best + r.recommended + r.notRecommended >= MIN_VOTES_PER_COUNT);

  type Row = (typeof rows)[number];
  const share = (r: Row) => r.best / (r.best + r.recommended + r.notRecommended);
  const best = rows
    .filter((r: Row) => r.best >= r.recommended && r.best >= r.notRecommended)
    .sort((a: Row, b: Row) => share(b) - share(a) || a.players - b.players)
    .map((r: Row) => r.players)
    .sort((a: number, b: number) => a - b);
  const recommended = rows.filter((r: Row) => r.best + r.recommended > r.notRecommended).map((r: Row) => r.players);
  return { best, recommended, votes: rows };
}

/** Median of the community age poll ("21 and up" counts as 21), or null with fewer than 10 votes. */
export function communityAge(item: XmlItem): number | null {
  const poll = (item.poll ?? []).find((p: XmlItem) => p.name === "suggested_playerage");
  const votes: { age: number; n: number }[] = (poll?.results?.[0]?.result ?? []).map((r: XmlItem) => ({
    age: Number.parseInt(r.value, 10),
    n: Number(r.numvotes),
  }));
  const total = votes.reduce((sum, v) => sum + v.n, 0);
  if (total < 10) return null;
  let seen = 0;
  for (const v of votes) {
    seen += v.n;
    if (seen >= total / 2) return v.age;
  }
  return null;
}

function toGame(item: XmlItem): BggGame {
  const names: XmlItem[] = item.name ?? [];
  const links = (type: string) =>
    (item.link ?? []).filter((l: XmlItem) => l.type === type && l.inbound !== "true").map((l: XmlItem) => String(l.value));
  const ratings: XmlItem = item.statistics?.ratings ?? {};
  const rank = (ratings.ranks?.rank ?? []).find((r: XmlItem) => r.name === "boardgame");
  const players = playerPoll(item);

  return {
    bggId: Number(item.id),
    type: item.type === "boardgameexpansion" ? "boardgameexpansion" : "boardgame",
    name: String(names.find((n) => n.type === "primary")?.value ?? names[0]?.value ?? ""),
    alternateNames: names.filter((n) => n.type === "alternate").map((n) => String(n.value)),
    yearPublished: positive(attr(item.yearpublished)),
    thumbnail: item.thumbnail ? String(item.thumbnail).trim() : null,
    image: item.image ? String(item.image).trim() : null,
    ratingAverage: positive(attr(ratings.average)),
    ratingBayes: positive(attr(ratings.bayesaverage)),
    usersRated: int(attr(ratings.usersrated)) ?? 0,
    rank: int(rank?.value),
    weight: positive(attr(ratings.averageweight)),
    numWeights: int(attr(ratings.numweights)) ?? 0,
    minPlayers: positive(attr(item.minplayers)),
    maxPlayers: positive(attr(item.maxplayers)),
    bestPlayers: players.best,
    recommendedPlayers: players.recommended,
    playerVotes: players.votes,
    minAge: positive(attr(item.minage)),
    communityAge: communityAge(item),
    minPlayTime: positive(attr(item.minplaytime)),
    maxPlayTime: positive(attr(item.maxplaytime)),
    mechanics: links("boardgamemechanic"),
    categories: links("boardgamecategory"),
    publishers: links("boardgamepublisher"),
  };
}

/** Parses a `thing?stats=1` response. Descriptions are skipped: the app doesn't show them yet. */
export function parseThings(xml: string): BggGame[] {
  const doc = parser.parse(xml);
  return (doc.items?.item ?? []).filter((item: XmlItem) => item.id).map(toGame);
}

/** Parses a `hot` response: ids of the games trending on BGG right now, hottest first. */
export function parseHot(xml: string): number[] {
  const doc = parser.parse(xml);
  return (doc.items?.item ?? []).map((item: XmlItem) => Number(item.id)).filter(Boolean);
}

/** Parses a `search` response, deduplicated by id (BGG lists a game once per requested type). */
export function parseSearch(xml: string): BggSearchHit[] {
  const doc = parser.parse(xml);
  const hits = new Map<number, BggSearchHit>();
  for (const item of doc.items?.item ?? []) {
    const id = Number(item.id);
    if (hits.has(id)) continue;
    hits.set(id, {
      id,
      type: item.type === "boardgameexpansion" ? "boardgameexpansion" : "boardgame",
      // Attribute values come back entity-decoded once; some names are double-encoded upstream.
      name: decodeHTML(String(item.name?.[0]?.value ?? "")),
      year: positive(attr(item.yearpublished)),
    });
  }
  return [...hits.values()];
}
