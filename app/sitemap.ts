import type { MetadataRoute } from "next";

import { languageAlternates, SITE } from "@/lib/site";

/** Each public page at its English address, with its address in every language (hreflang). */
const PAGES: { path: string; changeFrequency: "daily" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "monthly", priority: 1 },
  { path: "/rankings", changeFrequency: "daily", priority: 0.8 },
  { path: "/search", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const absolute = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absolute(path),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, href]) => [lang, absolute(href)])),
    },
  }));
}
