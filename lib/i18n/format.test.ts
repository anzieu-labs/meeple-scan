import { describe, expect, it } from "vitest";

import { formatPercent, formatRating, plural } from "./format";

const games = { one: "{count} gra", few: "{count} gry", many: "{count} gier", other: "{count} gry" };

describe("plural", () => {
  it("picks Polish's three forms", () => {
    expect(plural("pl", 1, games)).toBe("1 gra");
    expect(plural("pl", 3, games)).toBe("3 gry");
    expect(plural("pl", 5, games)).toBe("5 gier");
    expect(plural("pl", 22, games)).toBe("22 gry");
  });

  it("falls back to `other` when a language has no such form", () => {
    expect(plural("ja", 1, { one: "{count}件", other: "{count}件" })).toBe("1件");
    expect(plural("en", 2, { one: "{count} game", other: "{count} games" })).toBe("2 games");
  });
});

describe("numbers", () => {
  it("writes ratings and percentages the language's way", () => {
    expect(formatRating("en", 7.09)).toBe("7.1");
    expect(formatRating("de", 7.09)).toBe("7,1");
    expect(formatPercent("en", 0.93)).toBe("93%");
    expect(formatPercent("fr", 0.93)).toMatch(/^93\s%$/); // a non-breaking space before %
  });
});
