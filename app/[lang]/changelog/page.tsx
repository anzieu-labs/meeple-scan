import { cn } from "cn";
import type { Metadata } from "next";

import { display, SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
import { RELEASES } from "@/lib/changelog";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/changelog">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { changelog } = getDictionary(lang);
  return pageMetadata({ locale: lang, title: changelog.title, description: changelog.intro, path: "/changelog" });
}

/**
 * What each version changed, newest first. Laid out like the privacy page: a page of the app on a phone,
 * the landing's header and footer around a card on a computer.
 */
export default async function ChangelogPage({ params }: PageProps<"/[lang]/changelog">) {
  const { lang } = await params;
  const locale: Locale = hasLocale(lang) ? lang : "en";
  const { changelog } = getDictionary(locale);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  const heading = "lg:font-(family-name:--font-display) lg:font-extrabold";
  return (
    <div className={cn(display.variable, "flex flex-1 flex-col lg:min-h-dvh lg:bg-[#fff8e8] lg:text-[#103b2c]")}>
      <div className="hidden lg:block">
        <SiteHeader locale={locale} path="/changelog" />
      </div>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(var(--tab-bar,6rem)+1rem)] text-foreground lg:max-w-3xl lg:bg-transparent lg:pt-10 lg:pb-24 lg:text-inherit">
        <div className="lg:rounded-3xl lg:border-[3px] lg:border-[#103b2c] lg:bg-white lg:p-12 lg:shadow-[8px_8px_0_#00875a]">
          <header className="px-4 pt-6 pb-4 lg:px-0 lg:pt-0 lg:pb-8">
            <h1 className={cn("font-heading text-2xl font-bold tracking-tight lg:text-5xl", heading)}>{changelog.title}</h1>
            <p className="text-sm text-muted-foreground lg:mt-2 lg:text-base lg:text-[#103b2c]/60">{changelog.intro}</p>
          </header>
          <ol className="flex flex-col gap-8 px-4 pb-8 lg:gap-10 lg:px-0 lg:pb-0">
            {RELEASES.map(({ version, date }) => (
              <li key={version} className="flex flex-col gap-2" data-testid="release">
                <h2 className={cn("flex flex-wrap items-baseline gap-x-3 text-base font-semibold lg:text-2xl", heading)}>
                  {fill(changelog.version, { version })}
                  <time dateTime={date} className="text-sm font-normal text-muted-foreground lg:font-sans lg:text-base lg:text-[#103b2c]/60">
                    {day.format(new Date(date))}
                  </time>
                </h2>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground lg:text-base lg:text-[#103b2c]/80">
                  {changelog.releases[version].map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <div className="hidden lg:block">
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
}
