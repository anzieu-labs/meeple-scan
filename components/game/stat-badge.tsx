"use client";

import { Brain, Clock, Users, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "cn";

import { ratingTier, statFigure } from "@/lib/game/labels";
import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";
import { formatRating } from "@/lib/i18n/format";
import { scanStatStore, type ScanStat } from "@/lib/scan-stat";

import { ScoreBadge, TIER_DOT } from "./score-badge";

/** The stat chosen in Settings; the rating until the page has read it. */
export function useScanStat() {
  return useSyncExternalStore(scanStatStore.subscribe, scanStatStore.getSnapshot, scanStatStore.getServerSnapshot);
}

const STAT_ICON: Record<Exclude<ScanStat, "rating">, LucideIcon> = { complexity: Brain, time: Clock, players: Users };

/** Long figures ("30–60", "120–180") get smaller type to fit the circle. */
const figureSize = (value: string) => (value.length <= 3 ? "text-xl" : value.length <= 4 ? "text-base" : "text-sm");

/** The circle beside a scanned game: its rating, or the complexity, playing time or player count chosen in Settings. */
export function StatBadge({ game }: { game: GameCard }) {
  const { locale, t } = useI18n();
  const stat = useScanStat();
  if (stat === "rating") return <ScoreBadge game={game} />;
  const { value, label, spoken } = statFigure(stat, game, t, locale);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1" role="img" aria-label={spoken} data-stat={stat}>
      <div
        className={cn("flex size-14 items-center justify-center rounded-full bg-muted font-bold tabular-nums", figureSize(value ?? "–"))}
      >
        {value ?? "–"}
      </div>
      <span className="max-w-20 text-center text-xs leading-tight font-medium">{label}</span>
    </div>
  );
}

/** The same figure on one line, for a row in a list: "7.8 ●", or an icon and "2.4", "30–60 min", "3–4". */
export function StatInline({ game }: { game: GameCard }) {
  const { locale, t } = useI18n();
  const stat = useScanStat();
  if (stat === "rating") {
    const tier = ratingTier(game);
    return (
      <>
        {tier === "none" ? "–" : formatRating(locale, game.ratingAverage!)}
        <span className={`size-2.5 rounded-full ${TIER_DOT[tier]}`} aria-hidden />
      </>
    );
  }
  const Icon = STAT_ICON[stat];
  const { value, spoken } = statFigure(stat, game, t, locale);
  return (
    <>
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <span aria-label={spoken}>{value ?? "–"}</span>
    </>
  );
}
