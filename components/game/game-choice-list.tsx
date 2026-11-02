"use client";

import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";

import { GameThumb } from "./game-thumb";

/** Tappable list of games, used by the picker and search results. */
export function GameChoiceList({ games, onPick }: { games: GameCard[]; onPick: (game: GameCard) => void }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col gap-1">
      {games.map((game) => (
        <li key={game.bggId}>
          <button
            type="button"
            onClick={() => onPick(game)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <GameThumb game={game} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{game.name}</span>
              <span className="block text-xs text-muted-foreground">
                {[game.yearPublished, game.type === "boardgameexpansion" ? t.game.expansion : null].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
