import type { Metadata } from "next";

import { LOCALES, localePath, type Locale } from "./i18n/config";
import { en } from "./i18n/dictionaries/en";
import { SITE_URL } from "./site-url";

/** Name and public URL, shared by the metadata, the manifest, the sitemap and the share image. */
export const SITE = {
  name: "Meeple Scan",
  url: SITE_URL,
  /** The app's source code, linked from Settings. */
  repository: "https://github.com/anzieu-labs/meeple-scan",
  /** Where there's one language only (manifest, share image): English. */
  title: en.meta.title,
  description: en.meta.description,
};

/** Link previews' locale for each language. */
const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  "pt-BR": "pt_BR",
  it: "it_IT",
  pl: "pl_PL",
  ja: "ja_JP",
  "zh-Hans": "zh_CN",
  ko: "ko_KR",
};

/** A page's address in every language, for search engines (hreflang); x-default is the English address. */
export function languageAlternates(path: string) {
  return { ...Object.fromEntries(LOCALES.map((locale) => [locale, localePath(locale, path)])), "x-default": path };
}

/**
 * A page's metadata in one language: its title (shown as "title · Meeple Scan" unless `home`), description,
 * canonical URL and its addresses in the other languages, repeated for link previews (a page's `openGraph`
 * replaces the layout's whole, so it's spelled out in full).
 */
export function pageMetadata({
  locale,
  title,
  description,
  path,
  home = false,
}: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  home?: boolean;
}): Metadata {
  const url = localePath(locale, path);
  const full = home ? title : `${title} · ${SITE.name}`;
  // The share image from app/opengraph-image.tsx, which a page's own `openGraph` would otherwise drop.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE.title };
  return {
    title: home ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      url,
      siteName: SITE.name,
      title: full,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [image] },
  };
}
