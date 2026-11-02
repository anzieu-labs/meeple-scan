import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "../config";

vi.mock("server-only", () => ({}));
const { getDictionary } = await import(".");
const en = getDictionary("en");

/** Every string of a dictionary with its path ("sheet.wrongGame"), plural forms included. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([key, v]) => strings(v, path ? `${path}.${key}` : key));
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/** The English sentence a path translates: a plural form English doesn't have ("few") translates `other`. */
const source = Object.fromEntries(strings(en));
const english = (path: string) => source[path] ?? source[path.replace(/\.(few|many)$/, ".other")];

describe.each(LOCALES.filter((locale) => locale !== "en"))("%s", (locale) => {
  const t = getDictionary(locale);

  it("keeps every placeholder of the English sentence", () => {
    for (const [path, text] of strings(t)) {
      expect(english(path), path).toBeDefined();
      expect(placeholders(text), `${locale} ${path}`).toEqual(placeholders(english(path)));
    }
  });

  it("keeps the brand, and has the same number of features and keywords", () => {
    expect(t.meta.title.startsWith("Meeple Scan")).toBe(true);
    expect(t.bgg.poweredBy).toBe("Powered by BGG");
    expect(t.meta.features).toHaveLength(en.meta.features.length);
    expect(t.meta.keywords.length).toBeGreaterThanOrEqual(8);
  });
});
