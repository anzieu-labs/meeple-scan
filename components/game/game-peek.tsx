"use client";

import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";

import { GameThumb } from "./game-thumb";
import { ScoreBadge } from "./score-badge";

/**
 * The always-visible part of the sheet: box art, name and the score circle. `locked`: the game isn't
 * confirmed yet, so a question mark stands in for its score.
 */
export function GamePeek({ game, guess = false, locked = false }: { game: GameCard; guess?: boolean; locked?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3" data-testid="game-peek">
      <GameThumb game={game} size={64} />
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 font-heading text-base leading-snug font-semibold">{game.name}</h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {[game.yearPublished, game.type === "boardgameexpansion" && t.game.expansion].filter(Boolean).join(" · ")}
          {guess && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground">{t.game.bestGuess}</span>
          )}
        </p>
      </div>
      {locked ? <LockedScore /> : <ScoreBadge game={game} />}
    </div>
  );
}

/** Where the score goes until the game is confirmed: the same circle, with a question mark. */
function LockedScore() {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 flex-col items-center gap-1" role="img" aria-label={t.game.locked}>
      <div className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 text-xl font-bold text-muted-foreground">
        ?
      </div>
      <span className="max-w-20 text-center text-xs leading-tight font-medium text-muted-foreground">{t.game.confirmFirst}</span>
    </div>
  );
}
