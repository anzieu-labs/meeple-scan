"use client";

import type { ReactNode } from "react";

import { ratingTier } from "@/lib/game/labels";
import { useI18n } from "@/lib/i18n/client";
import { formatRating } from "@/lib/i18n/format";
import type { GameCard } from "@/lib/game/types";

import { GameThumb } from "./game-thumb";
import { TIER_DOT } from "./score-badge";

type RowGame = Pick<GameCard, "bggId" | "name" | "thumbnail" | "yearPublished" | "type" | "ratingAverage" | "usersRated">;

/** A tappable game in a list (history, rankings, search): art, name, a line under it, and the score. */
export function GameRow({
  game,
  detail,
  leading,
  priority,
  onSelect,
}: {
  game: RowGame;
  /** Under the name; the year (and "Expansion") by default. */
  detail?: ReactNode;
  /** Before the art, e.g. a rank number. */
  leading?: ReactNode;
  /** One of the first rows on the page: its art loads straight away. */
  priority?: boolean;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const tier = ratingTier(game);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      {leading}
      <GameThumb game={game} size={48} priority={priority} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{game.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail ?? [game.yearPublished, game.type === "boardgameexpansion" && t.game.expansion].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {tier === "none" ? "–" : formatRating(locale, game.ratingAverage!)}
        <span className={`size-2.5 rounded-full ${TIER_DOT[tier]}`} aria-hidden />
      </span>
    </button>
  );
}
