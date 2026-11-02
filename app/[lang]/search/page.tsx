import type { Metadata } from "next";

import { SearchView } from "@/components/search/search-view";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return pageMetadata({ locale: lang, title: meta.searchTitle, description: meta.searchDescription, path: "/search" });
}

export default function SearchPage() {
  return <SearchView />;
}
