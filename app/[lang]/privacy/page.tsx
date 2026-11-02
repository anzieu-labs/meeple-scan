import { cn } from "cn";
import type { Metadata } from "next";

import { display, SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
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

/**
 * What the app keeps, why and for how long; the durations come from what the cleanup cron deletes. On a
 * phone, a page of the app (above the tab bar); on a computer, the landing's header and footer around a card.
 */
export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  const locale: Locale = hasLocale(lang) ? lang : "en";
  const { privacy } = getDictionary(locale);
  const months = {
    photoMonths: RETENTION_MONTHS.photoLogs,
    eventMonths: RETENTION_MONTHS.events,
    feedbackMonths: RETENTION_MONTHS.feedback,
  };
  const heading = "lg:font-(family-name:--font-display) lg:font-extrabold";
  return (
    <div className={cn(display.variable, "flex flex-1 flex-col lg:min-h-dvh lg:bg-[#fff8e8] lg:text-[#103b2c]")}>
      <div className="hidden lg:block">
        <SiteHeader locale={locale} path="/privacy" />
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(var(--tab-bar,6rem)+1rem)] text-foreground lg:max-w-3xl lg:bg-transparent lg:pt-10 lg:pb-24 lg:text-inherit">
        <div className="lg:rounded-3xl lg:border-[3px] lg:border-[#103b2c] lg:bg-white lg:p-12 lg:shadow-[8px_8px_0_#00875a]">
          <header className="px-4 pt-6 pb-4 lg:px-0 lg:pt-0 lg:pb-8">
            <h1 className={cn("font-heading text-2xl font-bold tracking-tight lg:text-5xl", heading)}>{privacy.title}</h1>
            <p className="text-sm text-muted-foreground lg:mt-2 lg:text-[#103b2c]/60">{privacy.updated}</p>
          </header>
          <div className="flex flex-col gap-6 px-4 pb-8 lg:gap-8 lg:px-0 lg:pb-0">
            <p className="text-base leading-relaxed lg:text-xl">{privacy.intro}</p>
            {privacy.sections.map(({ title, text }) => (
              <section key={title} className="flex flex-col gap-1.5">
                <h2 className={cn("text-base font-semibold lg:text-2xl", heading)}>{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground lg:text-base lg:text-[#103b2c]/80">{fill(text, months)}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <div className="hidden lg:block">
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}
