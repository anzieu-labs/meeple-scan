import { describe, expect, it } from "vitest";

import type { BggGame } from "@/lib/bgg/parse";

import type { MatchInput } from "./clean";
import { rankCandidates } from "./rank";

const game = (bggId: number, name: string, extra: Partial<BggGame> = {}): BggGame => ({
  bggId,
  name,
  type: "boardgame",
  usersRated: 10_000,
  ...extra,
});
const input = (...queries: string[]): MatchInput => ({ queries, phrases: [], titles: queries });
const top = (games: BggGame[], ...queries: string[]) => rankCandidates(games, input(...queries), null)[0].game.name;

describe("rankCandidates", () => {
  it("prefers the edition the box spells over the base game one line matches exactly", () => {
    const games = [game(1, "Viticulture", { usersRated: 30_000 }), game(2, "Viticulture Essential Edition")];
    expect(top(games, "viticulture essential", "viticulture", "essential")).toBe("Viticulture Essential Edition");
    expect(top(games, "viticulture", "stonemaier")).toBe("Viticulture");
  });

  it("reads the edition's words across title lines, even run together", () => {
    const games = [game(1, "Endeavor", { usersRated: 20_000 }), game(2, "Endeavor: Deep Sea")];
    expect(top(games, "endeavor deepsea", "endeavor", "deepsea")).toBe("Endeavor: Deep Sea");
  });

  it("only counts the longer game's own name, not its alternate names", () => {
    const games = [game(1, "Mexican Train"), game(2, "Dominoes", { alternateNames: ["Mexican Train Dominoes"] })];
    expect(top(games, "mexicantrain double 12 color coded dominoes", "mexicantrain")).toBe("Mexican Train");
  });

  it("doesn't take an edition word from another box for this game's edition", () => {
    const games = [game(1, "Gloomhaven", { usersRated: 60_000 }), game(2, "Gloomhaven (Second Edition)")];
    expect(top(games, "lterz", "gloomhaven", "second")).toBe("Gloomhaven");
  });

  it("keeps two longer names in their order when both spell the same words", () => {
    const games = [
      game(1, "Great Western", { usersRated: 100 }),
      game(2, "Great Western Trail", { usersRated: 50_000 }),
      game(3, "Great Western Trail: Second Edition", { usersRated: 5_000 }),
    ];
    expect(top(games, "great western", "trail")).toBe("Great Western Trail");
  });
});
