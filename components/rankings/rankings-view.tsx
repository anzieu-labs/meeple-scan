"use client";

import { Flame, Trophy } from "lucide-react";
import { useState } from "react";

import { LazyGameDrawer } from "@/components/game/lazy-game-drawer";
import { GameRow } from "@/components/game/game-row";
import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";
import { compactCount, fill } from "@/lib/i18n/format";
import { cn } from "cn";

const LISTS = {
  hot: { label: "hot", icon: Flame, empty: "hotFailed" },
  top: { label: "top", icon: Trophy, empty: "topFailed" },
} as const;

/** BGG's hot list and its best-ranked games, one at a time; tapping a game opens its details. */
export function RankingsView({ hot, top }: { hot: GameCard[] | null; top: GameCard[] | null }) {
  const { locale, t } = useI18n();
  const [list, setList] = useState<keyof typeof LISTS>("hot");
  const [open, setOpen] = useState<GameCard | null>(null);
  const games = list === "hot" ? hot : top;

  return (
    <>
      <div role="tablist" aria-label={t.rankings.lists} className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(Object.keys(LISTS) as (keyof typeof LISTS)[]).map((key) => {
          const { label, icon: Icon } = LISTS[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={list === key}
              onClick={() => setList(key)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-foreground/70 transition-colors",
                list === key && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4" aria-hidden /> {t.rankings[label]}
            </button>
          );
        })}
      </div>

      {games?.length ? (
        <ol className="divide-y border-y" data-testid="ranking-list">
          {games.map((game, i) => (
            <li key={game.bggId}>
              <GameRow
                game={game}
                priority={i < 4}
                leading={<span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>}
                detail={
                  list === "top" && game.rank
                    ? fill(t.rankings.rankDetail, { rank: game.rank, count: compactCount(locale, game.usersRated) })
                    : [game.yearPublished, fill(t.rankings.ratings, { count: compactCount(locale, game.usersRated) })]
                        .filter(Boolean)
                        .join(" · ")
                }
                onSelect={() => setOpen(game)}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t.rankings[LISTS[list].empty]}</p>
      )}
      <PoweredByBgg className="mt-6" />
      <LazyGameDrawer bggId={open?.bggId ?? null} game={open} onClose={() => setOpen(null)} />
    </>
  );
}
