import { describe, expect, it } from "vitest";

import type { BggGame } from "@/lib/bgg/parse";

import type { BggSource } from "./match";
import { normalizeName } from "./rank";
import { matchVisionGames } from "./vision-match";

const game = (bggId: number, name: string, extra: Partial<BggGame> = {}): BggGame => ({
  bggId,
  name,
  type: "boardgame",
  usersRated: 10_000,
  ...extra,
});
const catalog = [
  game(266192, "Wingspan", { alternateNames: ["Na skrzydłach"] }),
  game(13, "Catan"),
  game(230802, "Azul"),
];

/** BGG's exact search on primary and alternate names; no name index. */
const bgg: BggSource = {
  search: async (query) =>
    catalog
      .filter((g) => [g.name, ...(g.alternateNames ?? [])].some((n) => normalizeName(n) === normalizeName(query)))
      .map((g) => ({ id: g.bggId, type: "boardgame" as const, name: g.name, year: null })),
  fetchGames: async (ids) => catalog.filter((g) => ids.includes(g.bggId)),
};

const names = async (...games: [string, string][]) => {
  const found = await matchVisionGames(
    games.map(([printed, bggName]) => ({ printed, bgg: bggName })),
    bgg,
  );
  return found && [found.main, ...found.extras].map((m) => m.ranked[0].game.name);
};

describe("matchVisionGames", () => {
  it("finds a box printed in another language by its BGG name, and shows the title as printed", async () => {
    const found = await matchVisionGames([{ printed: "Na skrzydłach", bgg: "Wingspan" }], bgg);
    expect(found?.main.ranked[0].game.name).toBe("Wingspan");
    expect(found?.main.decision).toBe("auto");
    expect(found?.text).toEqual(["Na skrzydłach"]);
  });

  it("falls back to the printed title when the BGG name is wrong", async () => {
    expect(await names(["Catan", "The Settlers of Catan"])).toEqual(["Catan"]);
  });

  it("finds every box on a shelf once, the first one as the main game", async () => {
    expect(await names(["AZUL", "Azul"], ["CATAN", "Catan"], ["Azul", "Azul"], ["Unknown Game", "Unknown Game"])).toEqual([
      "Azul",
      "Catan",
    ]);
  });

  it("gives up when the main game matches nothing, so OCR is used instead", async () => {
    expect(await names(["Unknown Game", "Unknown Game"], ["CATAN", "Catan"])).toBeNull();
    expect(await names()).toBeNull();
  });
});
