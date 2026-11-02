import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";
import { hasLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/settings">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return {
    ...pageMetadata({ locale: lang, title: meta.settingsTitle, description: meta.settingsDescription, path: "/settings" }),
    // Nothing here for search engines.
    robots: { index: false },
  };
}

export default function SettingsPage() {
  return <SettingsView />;
}
