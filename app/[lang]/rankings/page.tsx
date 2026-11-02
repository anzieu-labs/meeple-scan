import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Suspense } from "react";

import { PageHeader, PageShell } from "@/components/nav/page-shell";
import { RankingsView } from "@/components/rankings/rankings-view";
import { JsonLd } from "@/components/seo/json-ld";
import { Skeleton } from "@/components/ui/skeleton";
import { getHotGames, getTopGames } from "@/lib/game/rankings";
import type { GameCard } from "@/lib/game/types";
import { hasLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/rankings">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return pageMetadata({ locale: lang, title: meta.rankingsTitle, description: meta.rankingsDescription, path: "/rankings" });
}

export default async function RankingsPage({ params }: PageProps<"/[lang]/rankings">) {
  const { lang } = await params;
  const locale: Locale = hasLocale(lang) ? lang : "en";
  const t = getDictionary(locale);
  return (
    <PageShell>
      <PageHeader title={t.rankings.title} subtitle={t.rankings.subtitle} />
      <Suspense fallback={<RankingsSkeleton label={t.rankings.loading} />}>
        <Rankings locale={locale} />
      </Suspense>
    </PageShell>
  );
}

/**
 * Both lists, built ahead and served from the CDN, rebuilt in the background at most once an hour. When BGG
 * fails, the message is only kept for a minute, so the lists come back as soon as BGG does.
 */
async function Rankings({ locale }: { locale: Locale }) {
  "use cache";
  const t = getDictionary(locale);
  const [hot, top] = await Promise.allSettled([getHotGames(), getTopGames()]);
  for (const result of [hot, top]) if (result.status === "rejected") console.error("Rankings failed", result.reason);
  if (hot.status === "rejected" || top.status === "rejected") cacheLife("minutes");
  else cacheLife("hours");
  const hotGames = hot.status === "fulfilled" ? hot.value.map(forList) : null;
  const topGames = top.status === "fulfilled" ? top.value.map(forList) : null;
  return (
    <>
      {hotGames && <JsonLd data={gameList(t.meta.hotList, locale, hotGames)} />}
      {topGames && <JsonLd data={gameList(t.meta.topList, locale, topGames)} />}
      <RankingsView hot={hotGames} top={topGames} />
    </>
  );
}

/**
 * Only what the list and the game sheet show: alternate names, publishers, categories and the big box art
 * were a third of the page for 150 games.
 */
function forList(game: GameCard): GameCard {
  return { ...game, alternateNames: [], publishers: [], categories: [], image: null };
}

/** A ranked list for search engines: each game with its rating, linking to its BoardGameGeek page. */
function gameList(name: string, locale: Locale, games: GameCard[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    inLanguage: locale,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: games.length,
    itemListElement: games.map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: game.name,
      url: `https://boardgamegeek.com/${game.type}/${game.bggId}`,
      image: game.thumbnail ?? undefined,
    })),
  };
}

function RankingsSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 px-4" aria-label={label}>
      <Skeleton className="h-9 w-full rounded-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
