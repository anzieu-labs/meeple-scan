"use client";

import { cn } from "cn";

import type { PlayerVotes } from "@/lib/bgg/parse";
import { useI18n } from "@/lib/i18n/client";
import { compactCount, fill, formatPercent } from "@/lib/i18n/format";

const SEGMENTS = [
  { key: "best", className: "bg-score-excellent" },
  { key: "recommended", className: "bg-score-good" },
  { key: "notRecommended", className: "bg-score-poor/70" },
] as const;

/**
 * BGG's player-count poll, count by count: how many voters found each count best, recommended or not
 * recommended. The counts the game is best with are in bold.
 */
export function PlayerVotesChart({ votes, best }: { votes: PlayerVotes[]; best: number[] }) {
  const { locale, t } = useI18n();
  const poll = t.details.poll;
  const total = votes.reduce((n, v) => Math.max(n, v.best + v.recommended + v.notRecommended), 0);
  return (
    <section data-testid="player-votes">
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{poll.title}</h3>
      <ul className="flex flex-col gap-1.5">
        {votes.map((v) => {
          const sum = v.best + v.recommended + v.notRecommended;
          const pct = (n: number) => formatPercent(locale, n / sum);
          return (
            <li key={v.players} className="flex items-center gap-3 text-sm">
              <span className={cn("w-5 shrink-0 text-right tabular-nums", best.includes(v.players) && "font-bold")}>
                {v.players}
              </span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                {SEGMENTS.map(({ key, className }) => (
                  <span key={key} className={className} style={{ width: `${(100 * v[key]) / sum}%` }} />
                ))}
              </span>
              <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{pct(v.best + v.recommended)}</span>
              <span className="sr-only">
                {fill(poll.row, {
                  players: v.players,
                  best: pct(v.best),
                  recommended: pct(v.recommended),
                  notRecommended: pct(v.notRecommended),
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        {SEGMENTS.map(({ key, className }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", className)} /> {poll[key]}
          </span>
        ))}
        <span>{fill(poll.footer, { count: compactCount(locale, total) })}</span>
      </p>
    </section>
  );
}
