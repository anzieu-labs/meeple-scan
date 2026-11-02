import { describe, expect, it } from "vitest";

import { localePath, splitLocale } from "./config";
import { negotiateLocale } from "./negotiate";

describe("negotiateLocale", () => {
  it.each([
    ["fr-FR,fr;q=0.9,en;q=0.8", "fr"],
    ["fr-CA", "fr"],
    ["en-US,en;q=0.9,fr;q=0.8", "en"],
    // The browser's order counts, not the order of the app's languages.
    ["sv-SE,fr;q=0.7", "fr"],
    ["en;q=0.5,fr;q=0.9", "fr"],
    ["sv-SE,sv;q=0.9", "en"],
    ["de-AT,de;q=0.9", "de"],
    ["de-CH", "de"],
    ["es-MX,es;q=0.9", "es"],
    ["pt-BR", "pt-BR"],
    ["pt-PT,pt;q=0.9", "pt-BR"],
    ["it-IT", "it"],
    ["pl-PL,pl;q=0.9,en;q=0.8", "pl"],
    ["ja-JP,ja;q=0.9", "ja"],
    ["ko-KR,ko;q=0.9", "ko"],
    ["zh-CN,zh;q=0.9", "zh-Hans"],
    ["zh-Hans-CN", "zh-Hans"],
    ["zh-SG", "zh-Hans"],
    // Traditional Chinese readers get English, not Simplified Chinese, unless they also accept it.
    ["zh-TW,zh;q=0.9", "en"],
    ["zh-HK,en;q=0.5", "en"],
    ["zh-Hant-TW,zh-CN;q=0.5", "zh-Hans"],
    ["*", "en"],
    ["fr;q=0", "en"],
    ["", "en"],
    [null, "en"],
  ] as const)("%s -> %s", (header, locale) => {
    expect(negotiateLocale(header)).toBe(locale);
  });
});

describe("locale paths", () => {
  it("keeps English at today's addresses and prefixes other languages", () => {
    expect(localePath("en", "/rankings")).toBe("/rankings");
    expect(localePath("fr", "/rankings")).toBe("/fr/rankings");
    expect(localePath("fr", "/")).toBe("/fr");
  });

  it("reads the language back from an address", () => {
    expect(splitLocale("/fr/search")).toEqual({ locale: "fr", path: "/search" });
    expect(splitLocale("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocale("/search")).toEqual({ locale: "en", path: "/search" });
    expect(splitLocale("/")).toEqual({ locale: "en", path: "/" });
    // English pages' internal address, as the router reports it after the proxy's rewrite.
    expect(splitLocale("/en/search")).toEqual({ locale: "en", path: "/search" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
  });
});
