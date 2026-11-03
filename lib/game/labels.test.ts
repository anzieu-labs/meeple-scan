import { describe, expect, it } from "vitest";

import { fr } from "@/lib/i18n/dictionaries/fr";
import { compactCount } from "@/lib/i18n/format";

import { ageRow, complexityLabel, formatCounts, playersRow, playTimeText, ratingTier, statFigure } from "./labels";

describe("ratingTier", () => {
  it.each([
    [8.5, 1000, "excellent"],
    [8, 1000, "excellent"],
    [7.09, 145_099, "good"],
    [6.5, 1000, "average"],
    [5.2, 1000, "poor"],
    [8.45, 1, "none"], // a single rating isn't a score
    [null, 0, "none"],
  ] as const)("%s from %i ratings -> %s", (ratingAverage, usersRated, tier) => {
    expect(ratingTier({ ratingAverage, usersRated })).toBe(tier);
  });
});

describe("complexityLabel", () => {
  it.each([
    [1.2, "Light complexity"],
    [2.28, "Medium-light complexity"],
    [3.5, "Medium complexity"],
    [3.92, "Medium-heavy complexity"],
    [4.8, "Heavy complexity"],
    [null, null],
  ])("%s -> %s", (weight, label) => {
    expect(complexityLabel(weight)).toBe(label);
  });
});

describe("players", () => {
  it("formats count ranges", () => {
    expect(formatCounts([4])).toBe("4");
    expect(formatCounts([3, 4, 5, 6, 7])).toBe("3–7");
    expect(formatCounts([1, 2, 3, 5])).toBe("1–3, 5");
  });

  it("uses the community poll, else the box", () => {
    expect(playersRow({ bestPlayers: [4], recommendedPlayers: [3, 4], minPlayers: 3, maxPlayers: 4 })).toEqual({
      title: "Best with 4",
      subtitle: "Good with 3–4 · box says 3–4 players",
    });
    expect(playersRow({ bestPlayers: [], recommendedPlayers: [], minPlayers: 3, maxPlayers: 6 })).toEqual({
      title: "3–6 players",
      subtitle: "From the box",
    });
    expect(playersRow({ bestPlayers: [], recommendedPlayers: [], minPlayers: 1, maxPlayers: 1 })?.title).toBe("1 player");
    expect(playersRow({ bestPlayers: [], recommendedPlayers: [], minPlayers: null, maxPlayers: null })).toBeNull();
  });
});

describe("other card texts", () => {
  it("formats age, time and counts", () => {
    expect(ageRow({ minAge: 10, communityAge: 8 })).toEqual({ title: "Age 10+", subtitle: "Community says 8+" });
    expect(ageRow({ minAge: null, communityAge: 12 })).toEqual({ title: "Age 12+", subtitle: "Community vote" });
    expect(ageRow({ minAge: null, communityAge: null })).toBeNull();
    expect(playTimeText({ minPlayTime: 60, maxPlayTime: 120 })).toBe("60–120 min");
    expect(playTimeText({ minPlayTime: 45, maxPlayTime: 45 })).toBe("45 min");
    expect(compactCount("en", 145_099)).toBe("145K");
    expect(compactCount("en", 4363)).toBe("4.4K");
    expect(compactCount("en", 453)).toBe("453");
  });

  it("speaks French", () => {
    expect(complexityLabel(2.28, fr.details)).toBe("Complexité moyenne-légère");
    expect(playersRow({ bestPlayers: [4], recommendedPlayers: [3, 4], minPlayers: 3, maxPlayers: 4 }, fr.details, "fr")).toEqual({
      title: "Idéal à 4",
      subtitle: "Bien à 3–4 · la boîte indique 3 à 4 joueurs",
    });
    expect(playersRow({ bestPlayers: [], recommendedPlayers: [], minPlayers: 1, maxPlayers: 1 }, fr.details, "fr")?.title).toBe("1 joueur");
    expect(ageRow({ minAge: 10, communityAge: 8 }, fr.details)).toEqual({ title: "Dès 10 ans", subtitle: "La communauté dit 8 ans et plus" });
    expect(compactCount("fr", 4363)).toBe("4,4\u00a0k");
  });
});

describe("statFigure", () => {
  const catan = {
    weight: 2.28,
    minPlayTime: 60,
    maxPlayTime: 120,
    bestPlayers: [4],
    recommendedPlayers: [3, 4],
    minPlayers: 3,
    maxPlayers: 4,
  };
  const unknown = { ...catan, weight: null, minPlayTime: null, maxPlayTime: null, bestPlayers: [], minPlayers: null, maxPlayers: null };

  it("gives the short figure, the word under it and what is read aloud", () => {
    expect(statFigure("complexity", catan)).toEqual({ value: "2.3", label: "Medium-light", spoken: "Medium-light complexity, 2.3/5" });
    expect(statFigure("time", catan)).toEqual({ value: "60–120", label: "min", spoken: "60–120 min" });
    expect(statFigure("players", catan)).toEqual({ value: "4", label: "Best count", spoken: "Best with 4" });
    // Too few votes for a best count: the box's range.
    expect(statFigure("players", { ...catan, bestPlayers: [] })).toMatchObject({ value: "3–4", label: "Players" });
  });

  it("shows a dash and the stat's name when BGG doesn't know it", () => {
    expect(statFigure("complexity", unknown)).toEqual({ value: null, label: "Complexity", spoken: "Complexity: –" });
    expect(statFigure("time", unknown).value).toBeNull();
    expect(statFigure("players", unknown).value).toBeNull();
  });

  it("speaks French", () => {
    expect(statFigure("complexity", catan, fr, "fr")).toMatchObject({ value: "2,3", label: "Moyenne-légère" });
    expect(statFigure("players", catan, fr, "fr")).toMatchObject({ label: "Idéal", spoken: "Idéal à 4" });
  });
});
