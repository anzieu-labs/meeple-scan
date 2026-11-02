/**
 * The public address, for canonical links, the sitemap, link previews and redirects: every Vercel build
 * (previews included, which aren't indexed) points at it; local builds at localhost.
 */
export const SITE_URL = process.env.VERCEL ? "https://meeple-scan.com" : "http://localhost:3000";
