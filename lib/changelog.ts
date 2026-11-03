/**
 * Every version of the app, newest first, with the day it shipped. What each one changed is in the
 * dictionaries (`changelog.releases`), so a version listed here without its notes fails the type check;
 * the newest one is package.json's version (checked by a test).
 */
export const RELEASES = [
  { version: "1.1.0", date: "2026-11-03" },
  { version: "1.0.0", date: "2026-11-02" },
] as const;
