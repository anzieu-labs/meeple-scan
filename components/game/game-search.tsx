"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";

import { GameChoiceList } from "./game-choice-list";

/** Name search on BGG, for when a photo isn't enough. */
export function GameSearch({ initialQuery = "", onPick }: { initialQuery?: string; onPick: (game: GameCard) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<{ phase: "idle" | "loading" | "error" } | { phase: "done"; games: GameCard[] }>({
    phase: "idle",
  });

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      setState({ phase: "done", games: ((await res.json()) as { games: GameCard[] }).games });
    } catch {
      setState({ phase: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search.placeholder}
          aria-label={t.search.field}
          enterKeyHint="search"
          className="h-11 text-base"
        />
        <Button type="submit" size="lg" variant="secondary" className="h-11 px-4" disabled={query.trim().length < 2}>
          {t.search.button}
        </Button>
      </form>
      {state.phase === "loading" && <Skeleton className="h-24 w-full" />}
      {state.phase === "error" && <p className="text-sm text-destructive">{t.search.failed}</p>}
      {state.phase === "done" &&
        (state.games.length ? (
          <GameChoiceList games={state.games} onPick={onPick} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.search.none}</p>
        ))}
    </div>
  );
}
