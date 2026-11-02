import type { Metadata } from "next";

import { HistoryView } from "@/components/history/history-view";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/history">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return {
    ...pageMetadata({ locale: lang, title: meta.historyTitle, description: meta.historyDescription, path: "/history" }),
    // Kept on the phone: nothing for search engines.
    robots: { index: false },
  };
}

export default function HistoryPage() {
  return <HistoryView />;
}
