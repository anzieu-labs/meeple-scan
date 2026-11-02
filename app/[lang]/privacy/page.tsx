import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/nav/page-shell";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { RETENTION_MONTHS } from "@/lib/retention";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { privacy } = getDictionary(lang);
  return pageMetadata({ locale: lang, title: privacy.title, description: privacy.intro, path: "/privacy" });
}

/** What the app keeps, why and for how long; the durations come from what the cleanup cron deletes. */
export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  const locale: Locale = hasLocale(lang) ? lang : "en";
  const { privacy } = getDictionary(locale);
  const months = {
    photoMonths: RETENTION_MONTHS.photoLogs,
    eventMonths: RETENTION_MONTHS.events,
    feedbackMonths: RETENTION_MONTHS.feedback,
  };
  return (
    <PageShell>
      <PageHeader title={privacy.title} subtitle={privacy.updated} />
      <div className="flex max-w-2xl flex-col gap-6 px-4 pb-8">
        <p className="text-base leading-relaxed">{privacy.intro}</p>
        {privacy.sections.map(({ title, text }) => (
          <section key={title} className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{fill(text, months)}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
