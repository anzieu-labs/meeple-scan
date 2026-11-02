"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LazyGameDrawer } from "@/components/game/lazy-game-drawer";
import { GameRow } from "@/components/game/game-row";
import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import { PageHeader, PageShell } from "@/components/nav/page-shell";
import type { GameCard } from "@/lib/game/types";
import { addToHistory } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/format";

/** Pause in typing before searching: one search per word typed, not per letter. */
const DEBOUNCE_MS = 350;
const MIN_LENGTH = 2;

type Results = { query: string } & ({ phase: "loading" } | { phase: "done"; games: GameCard[] } | { phase: "error" });

/** Name search as you type, typo-tolerant ("wingspam" finds Wingspan); tapping a game opens its details. */
export function SearchView() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState<GameCard | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResults({ query: trimmed, phase: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const { games } = (await res.json()) as { games: GameCard[] };
        setResults({ query: trimmed, phase: "done", games });
      } catch {
        if (!controller.signal.aborted) setResults({ query: trimmed, phase: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const current = trimmed.length >= MIN_LENGTH ? results : null;

  return (
    <PageShell>
      <PageHeader title={t.search.title} subtitle={t.search.subtitle}>
        <form role="search" onSubmit={(e) => (e.preventDefault(), inputRef.current?.blur())} className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.field}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full rounded-full border bg-muted/60 pr-11 pl-11 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {current?.phase === "loading" ? (
            <Loader2 className="absolute top-1/2 right-3.5 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={t.search.searching} />
          ) : (
            query && (
              <button
                type="button"
                aria-label={t.search.clear}
                onClick={() => (setQuery(""), inputRef.current?.focus())}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            )
          )}
        </form>
      </PageHeader>

      {current?.phase === "error" && <p className="px-4 py-6 text-center text-sm text-destructive">{t.search.failed}</p>}
      {current?.phase === "done" &&
        (current.games.length ? (
          <ul className="divide-y border-y" data-testid="search-results">
            {current.games.map((game) => (
              <li key={game.bggId}>
                <GameRow
                  game={game}
                  onSelect={() => {
                    setOpen(game);
                    addToHistory(game);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{fill(t.search.noneFor, { query: current.query })}</p>
        ))}
      {!current && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.search.minLength}</p>}
      <PoweredByBgg className="mt-6" />
      <LazyGameDrawer bggId={open?.bggId ?? null} game={open} onClose={() => setOpen(null)} />
    </PageShell>
  );
}
