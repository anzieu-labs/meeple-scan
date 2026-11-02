import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import { TabBar } from "@/components/nav/tab-bar";
import { I18nProvider } from "@/lib/i18n/client";
import { hasLocale, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SITE } from "@/lib/site";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Every language is built ahead; proxy.ts sends each address to one of them ("/rankings" is /en/rankings). */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t.meta.title, template: `%s · ${SITE.name}` },
    description: t.meta.description,
    applicationName: SITE.name,
    keywords: t.meta.keywords,
    category: "games",
    formatDetection: { telephone: false },
    // An opaque status bar: with "black-translucent", iOS lays a home-screen app out one status bar too short at
    // launch (a blank strip at the bottom until the next navigation).
    appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <I18nProvider locale={lang} t={getDictionary(lang)}>
          {children}
          <TabBar />
        </I18nProvider>
        {/* Page views for Vercel Web Analytics: no cookies, nothing personal. Only reports on Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
