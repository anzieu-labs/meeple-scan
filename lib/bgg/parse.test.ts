import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseHot, parseSearch, parseThings } from "./parse";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const things = parseThings(fixture("thing.xml"));
const byId = (id: number) => things.find((g) => g.bggId === id)!;

describe("parseThings", () => {
  it("parses every item", () => {
    expect(things.map((g) => g.bggId).sort((a, b) => a - b)).toEqual([13, 325, 68448, 230802, 432107]);
  });

  it("reads the card fields for Catan", () => {
    const catan = byId(13);
    expect(catan).toMatchObject({
      type: "boardgame",
      name: "Catan",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      minAge: 10,
      minPlayTime: 60,
      maxPlayTime: 120,
      bestPlayers: [4],
      recommendedPlayers: [3, 4],
    });
    expect(catan.ratingAverage).toBeGreaterThan(6);
    expect(catan.usersRated).toBeGreaterThan(100_000);
    expect(catan.rank).toBeGreaterThan(0);
    expect(catan.weight).toBeGreaterThan(2);
    expect(catan.alternateNames).toContain("Die Siedler von Catan");
    expect(catan.mechanics).toContain("Dice Rolling");
    expect(catan.publishers).toContain("KOSMOS");
    expect(catan.thumbnail).toMatch(/^https:\/\/cf\.geekdo-images\.com\//);
  });

  it("matches BGG's own poll summary for multi-count games", () => {
    expect(byId(68448)).toMatchObject({ bestPlayers: [4, 5], recommendedPlayers: [3, 4, 5, 6, 7] }); // 7 Wonders
    expect(byId(230802)).toMatchObject({ bestPlayers: [2], recommendedPlayers: [2, 3, 4] }); // Azul
  });

  it("keeps the poll's votes count by count, for the player chart", () => {
    const votes = byId(230802).playerVotes ?? [];
    expect(votes.map((v) => v.players)).toEqual([1, 2, 3, 4]);
    const two = votes.find((v) => v.players === 2)!;
    expect(two.best).toBeGreaterThan(two.recommended + two.notRecommended);
    expect(byId(432107).playerVotes).toEqual([]);
  });

  it("marks expansions and leaves the base game out of the publisher list", () => {
    const seafarers = byId(325);
    expect(seafarers.type).toBe("boardgameexpansion");
    expect(seafarers.rank).toBeNull(); // expansions have no overall rank
  });

  it("treats missing data as null instead of 0", () => {
    const portugal = byId(432107); // one rating, no weight votes, no poll votes
    expect(portugal.weight).toBeNull();
    expect(portugal.numWeights).toBe(0);
    expect(portugal.bestPlayers).toEqual([]);
    expect(portugal.recommendedPlayers).toEqual([]);
    expect(portugal.communityAge).toBeNull();
    expect(portugal.ratingBayes).toBeNull();
  });
});

describe("parseHot", () => {
  it("lists the trending ids in order", () => {
    const ids = parseHot(fixture("hot.xml"));
    expect(ids).toHaveLength(50);
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
  });
});

describe("parseSearch", () => {
  it("parses an exact search", () => {
    expect(parseSearch(fixture("search-catan-exact.xml"))).toEqual([
      { id: 13, type: "boardgame", name: "Catan", year: 1995 },
    ]);
  });

  it("dedupes ids listed once per type and decodes names", () => {
    const hits = parseSearch(fixture("search-tzolkin.xml"));
    expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length);
    expect(hits.find((h) => h.id === 126163)?.name).toBe("Tzolk'in: The Mayan Calendar");
    expect(hits.find((h) => h.id === 143065)?.name).toBe("Tzolk'in: The Mayan Calendar – Tribes & Prophecies");
  });
});
