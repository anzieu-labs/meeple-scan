import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";

import { ICON_COLORS, IconArt } from "./app-icon";
import type { Locale } from "./i18n/config";
import { getDictionary } from "./i18n/dictionaries";
import { SITE } from "./site";

/** Link previews' size: what Facebook, LinkedIn and X show best (1.91:1). */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/** The screenshots' shape (public/screens/<lang>/*.jpg, made by `pnpm screenshots`). */
const SCREEN_RATIO = 824 / 1678;

/**
 * The fonts: Geist, the app's, for the text and Bricolage Grotesque, the website's, for the titles; Noto Sans for
 * Japanese, Chinese and Korean, which neither has.
 */
const CJK_FONT: Partial<Record<Locale, string>> = { ja: "Noto Sans JP", "zh-Hans": "Noto Sans SC", ko: "Noto Sans KR" };

/**
 * One weight of a Google font, cut down to the characters of `text` (a few kB, even in Japanese). Satori reads
 * TrueType, not the WOFF2 browsers get, so it's asked without a browser's user agent.
 */
async function googleFont(family: string, weight: number, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
  ).then((res) => res.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No ${family} ${weight} font for the share image`);
  return fetch(url).then((res) => res.arrayBuffer());
}

/** A screenshot in this language, inline: the image is drawn with no server to fetch it from. */
async function screen(locale: Locale, name: "scan" | "details" | "shelf") {
  const data = await readFile(join(process.cwd(), "public/screens", locale, `${name}.jpg`));
  return `data:image/jpeg;base64,${data.toString("base64")}`;
}

/**
 * What a language's image is drawn with: its three screens and its fonts, cut down to `text`. Cached, so the
 * image is drawn once at build time rather than at every request.
 */
async function assets(locale: Locale, text: string) {
  "use cache";
  cacheLife("max");
  const cjk = CJK_FONT[locale];
  const faces = [["Geist", 400], ["Bricolage Grotesque", 800], ...(cjk ? ([[cjk, 400], [cjk, 800]] as const) : [])] as const;
  const [scan, shelf, details, fonts] = await Promise.all([
    screen(locale, "scan"),
    screen(locale, "shelf"),
    screen(locale, "details"),
    Promise.all(faces.map(async ([name, weight]) => ({ name, weight, style: "normal" as const, data: await googleFont(name, weight, text) }))),
  ]);
  return { scan, shelf, details, fonts };
}

/** A phone showing `src`, `width` px wide, placed (and turned) by `style`. */
function Phone({ src, width, style }: { src: string; width: number; style: CSSProperties }) {
  const bezel = Math.round(width * 0.035);
  const inner = width - 2 * bezel;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        padding: bezel,
        borderRadius: width * 0.15,
        background: "#14110f",
        boxShadow: "0 30px 60px rgba(16, 59, 44, 0.35), 0 8px 18px rgba(16, 59, 44, 0.25)",
        ...style,
      }}
    >
      <div style={{ display: "flex", overflow: "hidden", borderRadius: width * 0.12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn by Satori, not a page */}
        <img src={src} width={inner} height={inner / SCREEN_RATIO} alt="" />
      </div>
    </div>
  );
}

/** A tick in the app's green, before each thing the app tells about a game. */
function Tick() {
  return (
    <svg width={34} height={34} viewBox="0 0 34 34">
      <circle cx={17} cy={17} r={17} fill={ICON_COLORS.meeple} />
      <path d="M10 17.5l4.5 4.5L24 12.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The link preview of every page in `locale`: the icon, a headline and what the app tells about each game, in
 * that language, beside three phones showing its screens in that language too (a shelf being scanned, the games
 * found, one game's sheet).
 */
export async function shareImage(locale: Locale) {
  const { meta } = getDictionary(locale);
  const text = [SITE.name, meta.shareHeadline, ...meta.sharePoints].join("");
  const cjk = CJK_FONT[locale];
  const body = cjk ? `Geist, ${cjk}` : "Geist";
  const display = cjk ? `Bricolage Grotesque, ${cjk}` : "Bricolage Grotesque";

  const { scan, shelf, details, fonts } = await assets(locale, text);

  // Long headlines (French, Italian...) a size down, to keep them to three lines.
  const headlineSize = cjk ? 46 : meta.shareHeadline.length > 46 ? 52 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: body,
          color: ICON_COLORS.frame,
          background: ICON_COLORS.background,
          backgroundImage: "radial-gradient(circle at 80% 45%, #ffe39a 0%, #ffd25f 32%, #ffc533 62%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 600, padding: "60px 0 0 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", borderRadius: 22, background: "rgba(255, 255, 255, 0.45)", padding: 4 }}>
              <IconArt size={72} />
            </div>
            <div style={{ fontFamily: display, fontSize: 42, fontWeight: 800, letterSpacing: -0.5 }}>{SITE.name}</div>
          </div>
          <div
            style={{
              marginTop: 40,
              fontFamily: display,
              fontSize: headlineSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: cjk ? 0 : -1,
              // "\n" ends a line: Chinese and Japanese, without spaces, would otherwise break anywhere.
              whiteSpace: "pre-line",
            }}
          >
            {meta.shareHeadline}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 40 }}>
            {meta.sharePoints.map((point) => (
              <div key={point} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 29, fontWeight: 400 }}>
                <Tick />
                {point}
              </div>
            ))}
          </div>
        </div>

        <Phone src={shelf} width={250} style={{ left: 640, top: 150, transform: "rotate(-9deg)" }} />
        <Phone src={details} width={250} style={{ left: 930, top: 150, transform: "rotate(9deg)" }} />
        <Phone src={scan} width={290} style={{ left: 765, top: 54 }} />
      </div>
    ),
    { ...SHARE_IMAGE_SIZE, fonts },
  );
}
