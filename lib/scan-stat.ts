/** What the scan screen shows next to each game it finds, chosen in Settings. */
export const SCAN_STATS = ["rating", "complexity", "time", "players"] as const;
export type ScanStat = (typeof SCAN_STATS)[number];

const KEY = "meeple-scan:scan-stat";
const DEFAULT: ScanStat = "rating";

let cache: ScanStat | null = null;
const listeners = new Set<() => void>();

const isStat = (value: unknown): value is ScanStat => SCAN_STATS.includes(value as ScanStat);

// Storage can be unavailable (private mode, blocked site data): the choice then lives for the page only.
function read(): ScanStat {
  if (cache) return cache;
  try {
    const saved = localStorage.getItem(KEY);
    cache = isStat(saved) ? saved : DEFAULT;
  } catch {
    cache = DEFAULT;
  }
  return cache;
}

export function setScanStat(stat: ScanStat) {
  cache = stat;
  try {
    localStorage.setItem(KEY, stat);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: also picks up a change made in another tab. */
export const scanStatStore = {
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
  getServerSnapshot: () => DEFAULT,
};
