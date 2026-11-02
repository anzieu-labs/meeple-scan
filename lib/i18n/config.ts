/**
 * The languages the app is in. English is the default, at today's addresses ("/rankings"); every other
 * language lives under its prefix ("/fr/rankings"). The URL decides the language: proxy.ts only guesses it for
 * addresses without a prefix.
 */
export const LOCALES = ["en", "de", "fr", "es", "pt-BR", "it", "pl", "ja", "zh-Hans", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The language the user picked themselves; it wins over the browser's languages. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language in its own words, for the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  it: "Italiano",
  pl: "Polski",
  ja: "日本語",
  "zh-Hans": "简体中文",
  ko: "한국어",
};

export const hasLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** A path ("/rankings") in this language: as is in English, under the language's prefix otherwise. */
export function localePath(locale: Locale, path: string) {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * The language of an address and the path without it: "/fr/search" -> fr, "/search"; "/search" -> en. English
 * pages also answer to their internal address ("/en/search", what the router reports after proxy.ts's rewrite).
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && hasLocale(first)) return { locale: first, path: `/${rest.join("/")}` };
  return { locale: DEFAULT_LOCALE, path: pathname };
}
