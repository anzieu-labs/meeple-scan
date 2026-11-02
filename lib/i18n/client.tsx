"use client";

import { createContext, useContext, type ReactNode } from "react";

import { LOCALE_COOKIE, localePath, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

/** The page's language and its words, for client components (the layout reads them from the URL). */
export function I18nProvider({ locale, t, children }: { locale: Locale; t: Dictionary; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

/** A year: the language picked in Settings wins over the browser's languages on every later visit (proxy.ts). */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Opens `path` (a page without language, "/settings") in another language, and remembers the choice. */
export function switchLocale(locale: Locale, path: string) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  // A full load: the whole page, its language tag and metadata switch together.
  window.location.assign(localePath(locale, path));
}

/** The language, its words, and `href()` for links that stay in this language. */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n needs an I18nProvider");
  return { ...context, href: (path: string) => localePath(context.locale, path) };
}
