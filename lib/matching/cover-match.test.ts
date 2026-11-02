import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { BggGame, BggSearchHit } from "@/lib/bgg/parse";

import type { OcrLine } from "./cover";
import { matchCover } from "./cover-match";
import type { BggSource } from "./match";
import { normalizeName } from "./rank";

const FIXTURES = join(__dirname, "__fixtures__");
/** Real PaddleOCR (PP-OCRv6 small) output from the ocr-eval set: BGG covers and generated shelf photos. */
const photos: Record<string, OcrLine[]> = JSON.parse(readFileSync(join(FIXTURES, "ocr-lines.json"), "utf8"));

/**
 * Replays recorded BGG and name-index answers. Run with RECORD_BGG=1 (with BGG_API_TOKEN and
 * DATABASE_URL set) to call the real services and refresh `bgg-recordings.json`.
 */
const RECORDINGS = join(FIXTURES, "bgg-recordings.json");
const recording = process.env.RECORD_BGG === "1";
if (recording) vi.setConfig({ testTimeout: 120_000 }); // live BGG calls retry with backoff
const recordings: Record<string, unknown> = existsSync(RECORDINGS) ? JSON.parse(readFileSync(RECORDINGS, "utf8")) : {};

async function replay<T>(key: string, live: () => Promise<T>): Promise<T> {
  if (recording) {
    const value = await live();
    recordings[key] = value;
    writeFileSync(RECORDINGS, `${JSON.stringify(recordings, null, 1)}\n`);
    return value;
  }
  if (!(key in recordings)) throw new Error(`No recording for ${key}; run with RECORD_BGG=1`);
  return recordings[key] as T;
}

function recordedGames(ids: number[]): BggGame[] {
  const byId = new Map<number, BggGame>();
  for (const [key, games] of Object.entries(recordings)) {
    if (key.startsWith("thing ")) for (const game of games as BggGame[]) byId.set(game.bggId, game);
  }
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`No recorded game ${missing.join(",")}; run with RECORD_BGG=1`);
  return ids.map((id) => byId.get(id)!);
}

async function source(): Promise<BggSource> {
  const client = recording ? await import("@/lib/bgg/client") : null;
  const names = recording ? await import("@/lib/game/name-index") : null;
  return {
    search: (query, { exact }) =>
      replay<BggSearchHit[]>(`search ${exact ? "exact" : "fuzzy"} ${query}`, () => client!.searchBgg(query, { exact })),
    // Like the app's game cache: any recorded game, whichever request it came with.
    fetchGames: (ids) =>
      recording
        ? replay<BggGame[]>(`thing ${[...ids].sort((a, b) => a - b).join(",")}`, () => client!.fetchGames(ids))
        : Promise.resolve(recordedGames(ids)),
    searchNames: (query) => replay<{ bggId: number }[]>(`names ${query}`, () => names!.searchNameIndex(query)),
  };
}

const topIds = async (photo: string) => {
  const { main, extras } = await matchCover(photos[photo], await source());
  return [main, ...extras].map((m) => m.ranked[0]?.game.bggId);
};

describe("matchCover on real OCR output", () => {
  it.each([
    ["13", "plain logo", [13]],
    ["230802", "short title", [230802]],
    ["167791", "title over two lines (TERRAFORMING / MARS)", [167791]],
    ["224517", "phone-like photo, two-line title (BRASS / BIRMINGHAM)", [224517]],
    // The original and the Essential Edition are the same game; the cover barely shows the edition.
    ["183394", "misread first letter (OITICULTURE), found by the name index", [183394, 128621]],
    ["822", "misread first letter (ARCASSONNE)", [822]],
    ["129622", "missing first letter (OVE LETTER)", [129622]],
    ["9209", "multi-word title", [9209]],
  ] as const)("cover %s (%s): the right game, no extra games", async (photo, _why, accepted) => {
    const ids = await topIds(photo);
    expect(ids).toHaveLength(1);
    expect(accepted).toContain(ids[0]);
  });

  it("finds every box on a shelf photo", async () => {
    expect(new Set(await topIds("366013-342942-230802"))).toEqual(new Set([366013, 342942, 230802]));
    expect(new Set(await topIds("167791-284083-13"))).toEqual(new Set([167791, 284083, 13]));
  });

  it("asks BGG only for exact names when our index already has the games", async () => {
    const bgg = await source();
    const searched: string[] = [];
    const counting: BggSource = {
      ...bgg,
      search: (query, options) => (searched.push(`${options.exact ? "exact" : "fuzzy"} ${query}`), bgg.search(query, options)),
    };
    const { main, extras } = await matchCover(photos["366013-342942-230802"], counting);
    expect(new Set([main, ...extras].map((m) => m.ranked[0]?.game.bggId))).toEqual(new Set([366013, 342942, 230802]));
    expect(searched.filter((s) => s.startsWith("fuzzy"))).toEqual([]);
  });

  it("still finds the games from our index when BGG refuses every search", async () => {
    const refusing: BggSource = {
      ...(await source()),
      search: () => Promise.reject(Object.assign(new Error("BGG search failed with 429"), { status: 429 })),
    };
    const { main, extras } = await matchCover(photos["366013-342942-230802"], refusing);
    expect(new Set([main, ...extras].map((m) => m.ranked[0]?.game.bggId))).toEqual(new Set([366013, 342942, 230802]));
  });
});

describe("other games on the photo", () => {
  const game = (bggId: number, name: string, publishers: string[] = []): BggGame => ({
    bggId,
    name,
    type: "boardgame",
    usersRated: 10_000,
    publishers,
  });
  const games = [
    game(1, "Marvel Dice Masters: Avengers vs. X-Men", ["WizKids"]),
    game(2, "Dice Masters"),
    game(3, "Dominion", ["Rio Grande Games"]),
    game(4, "Rio Grande"),
    game(5, "Azul: Queen's Garden"),
    game(6, "Azul"),
  ];
  // Our name index, reduced to exact names.
  const source: BggSource = {
    search: async () => [],
    fetchGames: async (ids) => games.filter((g) => ids.includes(g.bggId)),
    searchNames: async (query) =>
      games.filter((g) => normalizeName(g.name).includes(normalizeName(query))).map((g) => ({ bggId: g.bggId })),
  };
  const line = (text: string, x: number, y: number, height: number): OcrLine => ({
    text,
    score: 0.95,
    box: [x, y, x + 300, y + height],
  });
  const shown = async (lines: OcrLine[]) => {
    const { main, extras } = await matchCover(lines, source);
    return [main, ...extras].map((m) => m.ranked[0]?.game.name);
  };

  it("doesn't count the main box's smaller series name as another game", async () => {
    expect(await shown([line("AVENGERS VS X-MEN", 0, 300, 100), line("MARVEL DICE MASTERS", 0, 100, 40)])).toEqual([
      "Marvel Dice Masters: Avengers vs. X-Men",
    ]);
  });

  it("doesn't count the main box's publisher logo as another game", async () => {
    expect(await shown([line("DOMINION", 0, 100, 100), line("RIO GRANDE", 0, 600, 40)])).toEqual(["Dominion"]);
  });

  it("keeps a second box of the same family with a title as big", async () => {
    expect(await shown([line("AZUL QUEEN'S GARDEN", 0, 100, 100), line("AZUL", 600, 100, 90)])).toEqual([
      "Azul: Queen's Garden",
      "Azul",
    ]);
  });
});
