import { Gift, History, ScanEye, Smartphone, UserRoundX, type LucideIcon } from "lucide-react";
import { cacheLife } from "next/cache";
import { Bricolage_Grotesque } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";

import { TIER_BG } from "@/components/game/score-badge";
import { GitHubMark } from "@/components/icons/github-mark";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { IconArt } from "@/lib/app-icon";
import { ratingTier } from "@/lib/game/labels";
import { getHotGames } from "@/lib/game/rankings";
import type { GameCard } from "@/lib/game/types";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatRating } from "@/lib/i18n/format";
import { SITE } from "@/lib/site";
import bggLogo from "@/public/powered-by-bgg.png";

import { LanguageSwitcher } from "./language-switcher";

/** Chunky, a little playful: the lettering of a game box, for headings only. */
// Not preloaded: phones get this page hidden (the camera shows instead) and would download it for nothing.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  preload: false,
});

/** The palette of the app icon: meeple yellow, board green, and the dark green ink of a printed box. */
const INK = "#103b2c";

/**
 * The home page on a computer, in the colours of a board game box: the pitch and the QR code on the lid colour,
 * five facts, what's hot, the rulebook's clarifications and a feedback form. Phones
 * get the camera instead (components/scanner/scan-screen.tsx), so this only shows from 1024px wide.
 */
export async function Landing({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const words = t.landing;
  const href = (path: string) => localePath(locale, path);
  const [qr, hot] = await Promise.all([qrSvg(), hotGames()]);

  // auto-phrase: Japanese lines break between phrases, not in the middle of a word.
  return (
    <main className="hidden min-h-dvh bg-[#fff8e8] text-[#103b2c] [word-break:auto-phrase] lg:block">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-10 py-6">
        <Link href={href("/")} className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#ffc533] shadow-[3px_3px_0_#103b2c]">
            <IconArt size={36} />
          </span>
          <span className={`${display.className} text-2xl font-extrabold tracking-tight`}>{SITE.name}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      {/* The lid: the pitch, and the token that opens the app on a phone. */}
      <section className="relative overflow-hidden bg-[#ffc533] [background-image:radial-gradient(#103b2c22_1.5px,transparent_1.5px)] [background-size:22px_22px]">
        <div className="mx-auto grid max-w-6xl grid-cols-[1.25fr_0.75fr] items-center gap-16 px-10 pt-20 pb-28">
          <div>
            <p className="mb-5 inline-block rounded-full border-2 border-[#103b2c] px-4 py-1 text-xs font-bold tracking-[0.2em] uppercase">
              {words.kicker}
            </p>
            <h1 className={`${display.className} text-[5.25rem] leading-[0.95] font-extrabold tracking-tight text-balance`}>
              {words.headline}
            </h1>
            <p className="mt-7 max-w-xl text-xl leading-relaxed text-[#103b2c]/85">{words.lede}</p>
          </div>

          <div className="justify-self-center">
            <div className="w-80 -rotate-[4deg] rounded-[2rem] border-[3px] border-[#103b2c] bg-white p-6 shadow-[10px_10px_0_#103b2c]">
              <div className="aspect-square w-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className={`${display.className} mt-4 text-center text-xl font-extrabold`}>{words.qrTitle}</p>
              <p className="mt-1 text-center text-sm text-[#103b2c]/75">{words.qrHint}</p>
            </div>
          </div>
        </div>
      </section>

      {/* What it is, in five facts, overlapping the lid. */}
      <section className="relative mx-auto -mt-14 max-w-6xl px-10">
        <ul className="grid grid-cols-5 rounded-3xl border-[3px] border-[#103b2c] bg-white shadow-[6px_6px_0_#103b2c]">
          {words.features.map(({ title, text }, i) => (
            <Feature key={title} icon={FEATURE_ICONS[i]} title={title} text={text} last={i === words.features.length - 1} />
          ))}
        </ul>
      </section>

      {/* The app on a phone, in this language (pnpm screenshots). */}
      <section className="mx-auto max-w-6xl px-10 pt-24">
        <h2 className={`${display.className} mb-12 text-center text-4xl font-extrabold text-balance`}>{words.screensTitle}</h2>
        <ul className="grid grid-cols-3 items-start gap-10">
          {SCREENS.map((screen, i) => (
            <li key={screen} className={`flex flex-col items-center gap-5 ${i === 1 ? "" : "mt-10"}`}>
              <div
                className={`overflow-hidden rounded-[2.25rem] border-[7px] border-[#103b2c] bg-[#103b2c] shadow-[8px_8px_0_#00875a] ${SCREEN_TILT[i]}`}
              >
                <Image
                  src={`/screens/${locale}/${screen}.jpg`}
                  alt={words.screens[i]}
                  width={824}
                  height={1678}
                  sizes="256px"
                  className="block w-64 rounded-[1.75rem]"
                />
              </div>
              <p className="max-w-64 text-center font-semibold text-balance">{words.screens[i]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-10 py-24">
        <h2 className={`${display.className} mb-8 text-4xl font-extrabold text-balance`}>{words.hotTitle}</h2>
        <ol className="grid grid-cols-6 gap-x-5 gap-y-6">
          {hot.map((game, i) => (
            <HotGame key={game.bggId} game={game} position={i + 1} locale={locale} />
          ))}
        </ol>
      </section>

      {/* The rulebook's FAQ. */}
      <section className="border-y-[3px] border-[#103b2c] bg-white">
        <div className="mx-auto max-w-6xl px-10 py-20">
          <h2 className={`${display.className} mb-10 text-4xl font-extrabold`}>
            <span className="mr-3 text-[#00875a]">§</span>
            {words.faqTitle}
          </h2>
          <ol className="grid grid-cols-2 gap-x-16 gap-y-10">
            {words.faq.map(({ q, a }, i) => (
              <li key={q} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span
                  className={`${display.className} flex size-10 items-center justify-center rounded-full bg-[#ffc533] text-lg font-extrabold`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{q}</h3>
                  <p className="mt-1.5 leading-relaxed text-[#103b2c]/80">{a}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The same feedback form as in Settings, as a wide card above the footer. */}
      <section className="mx-auto max-w-6xl px-10 py-20">
        <div className="grid grid-cols-[1fr_2fr] items-center gap-12 rounded-3xl border-[3px] border-[#103b2c] bg-white p-10 shadow-[8px_8px_0_#00875a]">
          <div>
            <h2 className={`${display.className} text-4xl font-extrabold text-balance`}>{t.settings.feedback.title}</h2>
            <p className="mt-3 text-lg leading-relaxed text-[#103b2c]/75">{t.settings.feedback.hint}</p>
          </div>
          <FeedbackForm wide />
        </div>
      </section>

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
    </main>
  );
}

/** The phone screens, in the order of `landing.screens` (e2e/screenshots/screens.spec.ts makes them). */
// The scanner in the middle, raised and straight.
const SCREENS = ["shelf", "scan", "details"] as const;
const SCREEN_TILT = ["-rotate-3", "", "rotate-3"];

/** The icons of `landing.features`, in its order: recognition, free, no account, installable, local history. */
const FEATURE_ICONS: LucideIcon[] = [ScanEye, Gift, UserRoundX, Smartphone, History];

function Feature({ icon: Icon, title, text, last }: { icon: LucideIcon; title: string; text: string; last: boolean }) {
  return (
    <li className={`flex flex-col gap-3 px-6 py-7 ${last ? "" : "border-r-2 border-dashed border-[#103b2c]/25"}`}>
      {/* A hexagon, like a board tile. */}
      <span className="flex size-12 shrink-0 items-center justify-center bg-[#00875a] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]">
        <Icon className="size-5 text-[#ffc533]" aria-hidden />
      </span>
      <div>
        <p className="leading-tight font-bold">{title}</p>
        <p className="mt-1 text-sm leading-snug text-[#103b2c]/70">{text}</p>
      </div>
    </li>
  );
}

function HotGame({ game, position, locale }: { game: GameCard; position: number; locale: Locale }) {
  const tier = ratingTier(game);
  const art = game.image ?? game.thumbnail;
  return (
    <li>
      <a href={`https://boardgamegeek.com/${game.type}/${game.bggId}`} target="_blank" rel="noreferrer" className="group block">
        <div className="relative aspect-square overflow-hidden rounded-xl border-[2.5px] border-[#103b2c] bg-white shadow-[3px_3px_0_#103b2c] transition-transform group-hover:-translate-y-1">
          {/* The full box art, resized for the tile: BGG's thumbnail is too small to stay sharp on a retina screen. */}
          {/* Lazy, even the first row: phones get this page hidden, and a hidden lazy image is never downloaded. */}
          {art && <Image src={art} alt="" fill sizes="160px" className="object-cover" />}
          <span className="absolute top-1.5 left-1.5 rounded-full bg-[#103b2c] px-1.5 py-0.5 text-[0.7rem] font-bold text-[#ffc533]">
            #{position}
          </span>
          {tier !== "none" && (
            <span className={`absolute right-1.5 bottom-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${TIER_BG[tier]}`}>
              {formatRating(locale, game.ratingAverage!)}
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-xs font-semibold group-hover:underline">{game.name}</p>
      </a>
    </li>
  );
}

/** The QR code to the site, drawn once on the server in the box's ink. */
async function qrSvg() {
  "use cache";
  cacheLife("max");
  // `ref=qr`: visits from the code are counted as such (lib/events).
  return QRCode.toString(`${SITE.url}/?ref=qr`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: INK, light: "#0000" },
  });
}

/** BGG's twelve hottest games for the landing, rebuilt at most hourly; nothing (and kept a minute) when BGG fails. */
async function hotGames(): Promise<GameCard[]> {
  "use cache";
  try {
    const games = await getHotGames();
    cacheLife("hours");
    return games.slice(0, 12).map((g) => ({
      ...g,
      alternateNames: [],
      publishers: [],
      categories: [],
    }));
  } catch (error) {
    console.error("Landing: hot games failed", error);
    cacheLife("minutes");
    return [];
  }
}
