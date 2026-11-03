import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import pkg from "@/package.json";

import { RELEASES } from "./changelog";

vi.mock("server-only", () => ({}));
const { getDictionary } = await import("@/lib/i18n/dictionaries");
const en = getDictionary("en");

describe("changelog", () => {
  it("starts at package.json's version, newest first", () => {
    expect(RELEASES[0].version).toBe(pkg.version);
    const dates = RELEASES.map((release) => release.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it.each(LOCALES)("has as many notes for every version in %s as in English", (locale) => {
    const { releases } = getDictionary(locale).changelog;
    expect(Object.keys(releases)).toEqual(RELEASES.map((release) => release.version));
    for (const { version } of RELEASES) expect(releases[version], version).toHaveLength(en.changelog.releases[version].length);
  });
});
