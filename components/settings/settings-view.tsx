"use client";

import { Brain, ChevronDown, Clock, Star, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "cn";

import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import { useScanStat } from "@/components/game/stat-badge";
import { GitHubMark } from "@/components/icons/github-mark";
import { PageHeader, PageShell } from "@/components/nav/page-shell";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { switchLocale, useI18n } from "@/lib/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { SCAN_STATS, setScanStat, type ScanStat } from "@/lib/scan-stat";
import { SITE } from "@/lib/site";

const STAT_ICON: Record<ScanStat, LucideIcon> = { rating: Star, complexity: Brain, time: Clock, players: Users };

/** The language, what a scan shows first, a way to write to us, and where the code lives. */
export function SettingsView() {
  const { locale, t, href } = useI18n();
  return (
    <PageShell>
      <PageHeader title={t.settings.title} />
      <Section title={t.settings.language}>
        {/* A native select: on a phone it opens the system's own picker. */}
        <div className="relative">
          <select
            value={locale}
            onChange={(event) => switchLocale(event.target.value as Locale, "/settings")}
            aria-label={t.settings.language}
            data-testid="language-select"
            className="h-12 w-full appearance-none rounded-xl border bg-background pr-10 pl-4 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {LOCALES.map((option) => (
              <option key={option} value={option} lang={option}>
                {LOCALE_NAMES[option]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
      </Section>
      <Section title={t.settings.scanStat}>
        <ScanStatPicker />
      </Section>
      <Section title={t.settings.feedback.title}>
        <FeedbackForm />
      </Section>
      <div className="flex items-center justify-between px-4 pt-2">
        <a
          href={SITE.repository}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.settings.github}
          className="flex size-11 items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <GitHubMark className="size-7" />
        </a>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href={href("/changelog")} className="underline-offset-4 hover:underline">
            {t.changelog.title}
          </Link>
          <Link href={href("/privacy")} className="underline-offset-4 hover:underline">
            {t.privacy.title}
          </Link>
        </div>
        <PoweredByBgg credit={false} />
      </div>
    </PageShell>
  );
}

/** Rating, complexity, playing time or players: the figure in the circle beside each game a scan finds. */
function ScanStatPicker() {
  const { t } = useI18n();
  const chosen = useScanStat();
  return (
    <div role="radiogroup" aria-label={t.settings.scanStat} className="grid grid-cols-2 gap-2" data-testid="scan-stat">
      {SCAN_STATS.map((stat) => {
        const Icon = STAT_ICON[stat];
        const checked = stat === chosen;
        return (
          <button
            key={stat}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setScanStat(stat)}
            className={cn(
              "flex h-12 min-w-0 items-center gap-2 rounded-xl border bg-background px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              checked && "border-emerald-700 bg-emerald-700/10 text-emerald-700",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t.game.stats[stat]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4 pb-6">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}
