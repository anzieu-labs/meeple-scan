"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatRating } from "@/lib/i18n/format";

/**
 * BGG weight on a 1–5 scale. One neutral colour: heavier isn't worse, so it gets no red/green.
 */
export function ComplexityGauge({ weight }: { weight: number }) {
  const { locale } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((step) => {
          const fill = Math.max(0, Math.min(1, weight - (step - 1)));
          return (
            <span key={step} className="relative h-2 w-4 overflow-hidden rounded-full bg-muted">
              <span className="absolute inset-y-0 left-0 bg-foreground/70" style={{ width: `${fill * 100}%` }} />
            </span>
          );
        })}
      </div>
      <span className="w-8 text-right text-sm font-semibold tabular-nums">{formatRating(locale, weight)}</span>
    </div>
  );
}
