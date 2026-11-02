"use client";

import { Brain, Cake, Clock, ExternalLink, Star, Users } from "lucide-react";

import { ageRow, complexityLabel, playersRow, playTimeText, ratingTier } from "@/lib/game/labels";
import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";
import { compactCount, fill, formatRating } from "@/lib/i18n/format";

import { ComplexityGauge } from "./complexity-gauge";
import { DetailRow } from "./detail-row";
import { PlayerVotesChart } from "./player-votes";
import { TIER_DOT } from "./score-badge";

/** The expanded sheet for a matched game: Yuka-style rows and mechanics. */
export function GameDetails({ game }: { game: GameCard }) {
  const { locale, t } = useI18n();
  const tier = ratingTier(game);
  const players = playersRow(game, t.details, locale);
  const age = ageRow(game, t.details);
  const time = playTimeText(game, t.details);
  const ratingDetail = [
    fill(t.details.ratings, { count: compactCount(locale, game.usersRated) }),
    game.rank && fill(t.details.rank, { rank: game.rank }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4" data-testid="game-details">
      <ul className="divide-y divide-border">
        <DetailRow
          icon={Star}
          title={t.details.rated[tier]}
          subtitle={ratingDetail}
          trailing={
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
              {game.ratingAverage != null ? `${formatRating(locale, game.ratingAverage)}/10` : "–"}
              <span className={`size-3 rounded-full ${TIER_DOT[tier]}`} aria-hidden />
            </span>
          }
        />
        {game.weight != null && (
          <DetailRow
            icon={Brain}
            title={complexityLabel(game.weight, t.details)!}
            subtitle={fill(t.details.votes, { count: compactCount(locale, game.numWeights) })}
            trailing={<ComplexityGauge weight={game.weight} />}
          />
        )}
        {players && <DetailRow icon={Users} title={players.title} subtitle={players.subtitle} />}
        {age && <DetailRow icon={Cake} title={age.title} subtitle={age.subtitle} />}
        {time && <DetailRow icon={Clock} title={time} subtitle={t.details.playingTime} />}
      </ul>

      {game.playerVotes.length > 0 && <PlayerVotesChart votes={game.playerVotes} best={game.bestPlayers} />}

      {game.mechanics.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.details.mechanics}</h3>
          <ul className="flex flex-wrap gap-2">
            {game.mechanics.map((mechanic) => (
              <li key={mechanic} className="rounded-full bg-muted px-3 py-1 text-xs">
                {mechanic}
              </li>
            ))}
          </ul>
        </section>
      )}

      <a
        href={`https://boardgamegeek.com/${game.type}/${game.bggId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t.details.viewOnBgg} <ExternalLink className="size-4" aria-hidden />
      </a>
    </div>
  );
}
