import { Bricolage_Grotesque } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { GitHubMark } from "@/components/icons/github-mark";
import { IconArt } from "@/lib/app-icon";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SITE } from "@/lib/site";
import bggLogo from "@/public/powered-by-bgg.png";

import { LanguageSwitcher } from "./language-switcher";

/** Chunky, a little playful: the lettering of a game box, for headings only. */
// Not preloaded: phones get this page hidden (the camera shows instead) and would download it for nothing.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  preload: false,
  // For pages that use it from 1024px only (`lg:font-(family-name:--font-display)`): phones never download it.
  variable: "--font-display",
});

/** The desktop pages' top bar: the logo, and the language picker that reopens `path` in another language. */
export function SiteHeader({ locale, path }: { locale: Locale; path: string }) {
  const href = (to: string) => localePath(locale, to);
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-10 py-6">
      <Link href={href("/")} className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[#ffc533] shadow-[3px_3px_0_#103b2c]">
          <IconArt size={36} />
        </span>
        <span className={`${display.className} text-2xl font-extrabold tracking-tight`}>{SITE.name}</span>
      </Link>
      <LanguageSwitcher path={path} />
    </header>
  );
}

/** The desktop pages' footer: the logo, BGG's attribution, what's new, the privacy page and the source code. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const words = t.landing;
  const href = (to: string) => localePath(locale, to);
  return (
    <footer className="bg-[#103b2c] text-[#fff8e8]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-10 py-8 text-sm">
        <Link href={href("/")} className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#ffc533]">
            <IconArt size={28} />
          </span>
          <span className={`${display.className} text-lg font-extrabold`}>{SITE.name}</span>
        </Link>
        {/* BGG's required attribution: the official logo, on paper because its lettering is dark. */}
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[#fff8e8] px-3 py-1.5 transition-transform hover:-translate-y-0.5"
        >
          <Image src={bggLogo} alt={t.bgg.poweredBy} className="h-8 w-auto" />
        </a>
        <div className="flex items-center gap-8">
          <Link href={href("/changelog")} className="font-semibold text-[#fff8e8]/90 hover:text-[#ffc533]">
            {t.changelog.title}
          </Link>
          <Link href={href("/privacy")} className="font-semibold text-[#fff8e8]/90 hover:text-[#ffc533]">
            {t.privacy.title}
          </Link>
          <a
            href={SITE.repository}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 font-semibold text-[#fff8e8]/90 hover:text-[#ffc533]"
          >
            <GitHubMark className="size-6" />
            {words.footerCode}
          </a>
        </div>
      </div>
    </footer>
  );
}
