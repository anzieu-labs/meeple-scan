"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import { GitHubMark } from "@/components/icons/github-mark";
import { PageHeader, PageShell } from "@/components/nav/page-shell";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { switchLocale, useI18n } from "@/lib/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { SITE } from "@/lib/site";

/** The language, a way to write to us, and where the code lives. */
export function SettingsView() {
  const { locale, t } = useI18n();
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
        <PoweredByBgg credit={false} />
      </div>
    </PageShell>
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
