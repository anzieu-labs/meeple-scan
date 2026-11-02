import type { GameCard } from "@/lib/game/types";

/** What the history list needs to draw a row without asking the server. */
export type HistoryEntry = Pick<
  GameCard,
  "bggId" | "name" | "thumbnail" | "yearPublished" | "type" | "ratingAverage" | "usersRated"
> & { scannedAt: number };

const KEY = "meeple-scan:history";
/** Where the history was kept before the app was called Meeple Scan: read once, then moved to KEY. */
const OLD_KEY = "bgg-scan:history";
export const HISTORY_LIMIT = 50;
const EMPTY: HistoryEntry[] = [];

let cache: HistoryEntry[] | null = null;
const listeners = new Set<() => void>();

/** One row per game, newest first. Entries saved before history was keyed by game may repeat one. */
function dedupe(entries: HistoryEntry[]) {
  const seen = new Set<number>();
  return entries.filter((e) => Number.isInteger(e?.bggId) && !seen.has(e.bggId) && seen.add(e.bggId));
}

// Storage can be unavailable (private mode, blocked site data): the list then lives for the page only.
function read(): HistoryEntry[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? dedupe(parsed) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries: HistoryEntry[]) {
  cache = entries;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

/** Newest first; one row per game (seeing it again moves it to the top), capped at 50. */
export function addToHistory(game: GameCard, scannedAt = Date.now()) {
  const { bggId, name, thumbnail, yearPublished, type, ratingAverage, usersRated } = game;
  const entry: HistoryEntry = { bggId, name, thumbnail, yearPublished, type, ratingAverage, usersRated, scannedAt };
  write([entry, ...read().filter((e) => e.bggId !== bggId)].slice(0, HISTORY_LIMIT));
}

export function removeFromHistory(bggId: number) {
  write(read().filter((e) => e.bggId !== bggId));
}

export function clearHistory() {
  write([]);
}

/** For useSyncExternalStore: also picks up changes made in other tabs. */
export const historyStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      cache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot: read,
  getServerSnapshot: () => EMPTY,
};
