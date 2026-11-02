import { cn } from "cn";

import { ratingTier, type RatingTier } from "@/lib/game/labels";
import { useI18n } from "@/lib/i18n/client";
import { fill, formatRating } from "@/lib/i18n/format";
import type { GameCard } from "@/lib/game/types";

export const TIER_BG: Record<RatingTier, string> = {
  excellent: "bg-score-excellent text-white",
  good: "bg-score-good text-black",
  average: "bg-score-average text-black",
  poor: "bg-score-poor text-white",
  none: "bg-score-none text-white",
};

export const TIER_DOT: Record<RatingTier, string> = {
  excellent: "bg-score-excellent",
  good: "bg-score-good",
  average: "bg-score-average",
  poor: "bg-score-poor",
  none: "bg-score-none",
};

/** Yuka-style score: coloured circle with the BGG rating, and the word under it (never colour alone). */
export function ScoreBadge({ game, className }: { game: Pick<GameCard, "ratingAverage" | "usersRated">; className?: string }) {
  const { locale, t } = useI18n();
  const tier = ratingTier(game);
  const value = tier === "none" ? null : formatRating(locale, game.ratingAverage!);
  const label = t.game.tiers[tier];
  return (
    <div
      className={cn("flex shrink-0 flex-col items-center gap-1", className)}
      role="img"
      aria-label={value ? fill(t.game.score, { value, label }) : label}
      data-tier={tier}
    >
      <div className={cn("flex size-14 items-center justify-center rounded-full text-xl font-bold tabular-nums", TIER_BG[tier])}>
        {value ?? "–"}
      </div>
      <span className="max-w-20 text-center text-xs leading-tight font-medium">{tier === "none" ? t.game.fewRatings : label}</span>
    </div>
  );
}
