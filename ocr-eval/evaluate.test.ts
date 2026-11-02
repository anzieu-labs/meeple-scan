/**
 * Scores box-cover OCR end to end: did OCR read the title, and does the matcher find the right BGG game?
 * Run after run_ocr.py, with BGG_API_TOKEN and DATABASE_URL set:  OCR_EVAL=1 pnpm exec vitest run ocr-eval
 * BGG searches are cached in out/bgg-cache.json, so reruns are fast and only new queries hit BGG; game
 * details come from the app's own cache in Neon, like in production.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { searchBgg } from "@/lib/bgg/client";
import { getGames } from "@/lib/game/games";
import { searchNameIndex } from "@/lib/game/name-index";
import type { OcrLine } from "@/lib/matching/cover";
import { matchCover, type CoverMatch } from "@/lib/matching/cover-match";
import type { BggSource, MatchResult } from "@/lib/matching/match";
import { normalizeName } from "@/lib/matching/rank";
import { matchVisionGames, type VisionGame } from "@/lib/matching/vision-match";

vi.setConfig({ testTimeout: 3 * 60 * 60_000 }); // BGG searches that aren't cached yet are slow

const ROOT = __dirname;
const OUT = join(ROOT, "out");
const CACHE = join(OUT, "bgg-cache.json");
const covers: { bggId: number; name: string }[] = JSON.parse(readFileSync(join(ROOT, "data", "covers.json"), "utf8"));
const nameOf = new Map(covers.map((c) => [c.bggId, c.name]));

const cache: Record<string, unknown> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
async function cached<T>(key: string, live: () => Promise<T>): Promise<T> {
  if (!(key in cache)) {
    cache[key] = await live();
    // Merged with what parallel runs wrote meanwhile, so they don't drop each other's searches.
    const onDisk = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
    writeFileSync(CACHE, JSON.stringify(Object.assign(cache, { ...onDisk, ...cache })));
  }
  return cache[key] as T;
}
// NAME_INDEX=0 turns the local name index off, to compare with BGG search alone; BGG_SEARCH=0 turns BGG's
// search off (index only: fast, for screening OCR engines); MODELS=a,b limits the OCR outputs evaluated;
// SETS=covers,gallery limits the photo sets; SPLIT=tune|holdout keeps one half of the games (split.py);
// REPORT=name writes out/report-<name>.md instead of report-<model>.md, for runs of one model side by side.
const useNameIndex = process.env.NAME_INDEX !== "0";
const useBggSearch = process.env.BGG_SEARCH !== "0";
const bgg: BggSource = {
  search: (q, { exact }) =>
    useBggSearch ? cached(`search ${exact ? "exact" : "fuzzy"} ${q}`, () => retryThrottled(() => searchBgg(q, { exact }))) : Promise.resolve([]),
  fetchGames: (ids) => retryThrottled(() => getGames(ids)),
  searchNames: useNameIndex ? (q) => searchNameIndex(q) : undefined,
};

// GEMINI=name: when the OCR match isn't automatic, the games a vision model named on the photo
// (out/<name>/<set>/<file>.json, { games }) are matched instead. GEMINI_ALWAYS=1 matches them first on
// every photo, as the app does (pnpm export:photo-logs writes the app's answers to out/gemini-app).
// TRIGGERS=path writes the list of photos not matched automatically, to send to the model.
const gemini = process.env.GEMINI;
const geminiAlways = process.env.GEMINI_ALWAYS === "1";

/**
 * The games a vision model named (main first), matched as in the app, or null when the first one matches
 * nothing. Each game is { printed, bgg }, or a title as printed (the first prompt) searched alone.
 */
async function visionMatch(path: string): Promise<CoverMatch | null> {
  if (!existsSync(path)) return null;
  const { games } = JSON.parse(readFileSync(path, "utf8")) as { games: (string | VisionGame)[] };
  return matchVisionGames(games.map((g) => (typeof g === "string" ? { printed: g, bgg: g } : g)), bgg);
}

/** Long runs search and fetch details of games not cached yet: wait out BGG's 429s instead of failing the run. */
async function retryThrottled<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= 5 || !String(error).includes("429")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5_000 * 2 ** attempt));
    }
  }
}

const squash = (s: string) => normalizeName(s).replace(/\s+/g, "");
/** "Tzolk'in: The Mayan Calendar" -> the part a box shows in big letters, "tzolkin". */
function titleWasRead(expected: string, lines: OcrLine[]) {
  const head = squash(expected.split(/:|–| - /)[0].replace(/^the /i, "").replace(/\.+$/, ""));
  return squash(lines.map((l) => l.text).join(" ")).includes(head);
}

interface Row {
  set: string;
  /** BGG ids on the picture: one for a cover, 2–3 for a shelf ("13-822-9209"). */
  expected: number[];
  read: boolean;
  queries: string[];
  /** Games shown: the main one, then the extras. */
  found: { bggId: number; name: string }[];
  /** What the app shows: the main game unless nothing matched well enough, then the other games found. */
  mainShown: number | null;
  extrasShown: number[];
  /** 1-based position of the first expected game among the main match's candidates, 0 = not in the top 5. */
  rank: number;
  decision: string;
  seconds: number;
}

it("evaluates box-cover OCR", async () => {
  expect(process.env.BGG_API_TOKEN, "BGG_API_TOKEN must be set").toBeTruthy();
  const only = process.env.MODELS?.split(",");
  const sets = process.env.SETS?.split(",");
  const split = process.env.SPLIT;
  const models = readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!only || only.includes(d.name)))
    .map((d) => d.name);

  for (const model of models) {
    const rows: Row[] = [];
    const triggers: { set: string; file: string }[] = [];
    let rescued = 0;
    /** Single-box photos with Gemini's answer: whose main game was right. */
    const versus = { both: 0, ocrOnly: [] as string[], geminiOnly: 0, neither: 0 };
    for (const set of readdirSync(join(OUT, model)).filter((s) => !sets || sets.includes(s))) {
      for (const file of readdirSync(join(OUT, model, set)).filter((f) => f.endsWith(".json"))) {
        const expected = file.replace(".json", "").split("-").map((id) => Number.parseInt(id, 10));
        if (split && !expected.every((id) => halfOf(id) === split)) continue;
        const ocr = JSON.parse(readFileSync(join(OUT, model, set, file), "utf8")) as { seconds: number; lines: OcrLine[] };
        const cover = await matchCover(ocr.lines, bgg);
        let { main, extras } = cover;
        if (main.decision !== "auto") triggers.push({ set, file });
        const vision = gemini ? await visionMatch(join(OUT, gemini, set, file)) : null;
        if (gemini && !isShelfSet(set) && existsSync(join(OUT, gemini, set, file))) {
          const right = (m: MatchResult | undefined) => m?.decision !== "none" && expected.includes(m?.ranked[0]?.game.bggId ?? -1);
          const [ocrRight, geminiRight] = [right(cover.main), right(vision?.main)];
          if (ocrRight && geminiRight) versus.both++;
          else if (ocrRight) versus.ocrOnly.push(`${set}/${file} ${cover.main.ranked[0].game.name} (Gemini: ${vision?.main.ranked[0]?.game.name ?? "nothing"})`);
          else if (geminiRight) versus.geminiOnly++;
          else versus.neither++;
        }
        if (vision && (geminiAlways || main.decision !== "auto")) [{ main, extras }, rescued] = [vision, rescued + 1];
        const rank = main.ranked.findIndex((c) => expected.includes(c.game.bggId)) + 1;
        rows.push({
          set,
          expected,
          read: expected.length === 1 && titleWasRead(nameOf.get(expected[0]) ?? "", ocr.lines),
          queries: main.queries,
          found: [main, ...extras].flatMap((m) => m.ranked.slice(0, 1).map((c) => ({ bggId: c.game.bggId, name: c.game.name }))),
          mainShown: main.decision === "none" ? null : (main.ranked[0]?.game.bggId ?? null),
          extrasShown: extras.map((m) => m.ranked[0].game.bggId),
          rank: rank > 5 ? 0 : rank,
          decision: main.decision,
          seconds: ocr.seconds,
        });
      }
    }
    const head = gemini
      ? `main game right on single-box photos: both ${versus.both}, Gemini only ${versus.geminiOnly}, OCR only ${versus.ocrOnly.length}, neither ${versus.neither}`
      : "";
    const ocrOnly = versus.ocrOnly.length ? `\n\nOCR right, Gemini not:\n${versus.ocrOnly.map((l) => `- ${l}`).join("\n")}` : "";
    writeFileSync(
      join(OUT, `report-${process.env.REPORT ?? model}.md`),
      report(model, rows) + (head ? `\n\n## OCR vs Gemini\n\n${head}${ocrOnly}\n` : ""),
    );
    if (process.env.TRIGGERS) writeFileSync(process.env.TRIGGERS, JSON.stringify(triggers));
    console.log(`${model}: ${triggers.length} photos not matched automatically${gemini ? `, ${rescued} matched from ${gemini}` : ""}`);
    console.log(summary(model, rows));
    if (head) console.log(head);
  }
});

/** Mirrors split.py: the half of the evaluation a game belongs to. */
const halfOf = (bggId: number) => (bggId % 2 === 0 ? "tune" : "holdout");

const isShelfSet = (set: string) => set.startsWith("shelves");

/**
 * One number to compare settings: games shown right (main game on single-box photos, every game on
 * shelves) minus twice the games shown wrong, since a wrong answer is worse than none.
 */
function overall(rows: Row[]) {
  let right = 0;
  let wrong = 0;
  let possible = 0;
  for (const r of rows) {
    const shown = [...(r.mainShown === null ? [] : [r.mainShown]), ...r.extrasShown];
    if (isShelfSet(r.set)) {
      possible += r.expected.length;
      right += shown.filter((id) => r.expected.includes(id)).length;
      wrong += shown.filter((id) => !r.expected.includes(id)).length;
    } else {
      possible += 1;
      if (r.mainShown !== null && r.expected.includes(r.mainShown)) right++;
      wrong += shown.filter((id) => !r.expected.includes(id)).length;
    }
  }
  return { score: right - 2 * wrong, right, wrong, possible, photos: rows.length };
}

function pct(n: number, total: number) {
  return `${Math.round((100 * n) / total)}% (${n}/${total})`;
}

const falseFinds = (r: Row) => r.found.filter((f) => !r.expected.includes(f.bggId));

function summary(model: string, rows: Row[]) {
  const sets = [...new Set(rows.map((r) => r.set))];
  return sets
    .map((set) => {
      const r = rows.filter((x) => x.set === set);
      const secs = r.map((x) => x.seconds).sort((a, b) => a - b);
      const ocr = `OCR ${(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(2)}s avg`;
      if (isShelfSet(set)) {
        const expected = r.reduce((n, x) => n + x.expected.length, 0);
        const found = r.reduce((n, x) => n + x.found.filter((f) => x.expected.includes(f.bggId)).length, 0);
        const wrong = r.reduce((n, x) => n + falseFinds(x).length, 0);
        return [`${model.padEnd(6)} ${set.padEnd(7)}`, `games found ${pct(found, expected)}`, `wrong games shown ${wrong}`, ocr].join(" · ");
      }
      return [
        `${model.padEnd(6)} ${set.padEnd(7)}`,
        `title read ${pct(r.filter((x) => x.read).length, r.length)}`,
        `top-1 ${pct(r.filter((x) => x.rank === 1).length, r.length)}`,
        `top-5 ${pct(r.filter((x) => x.rank > 0).length, r.length)}`,
        `false extra games ${r.reduce((n, x) => n + x.found.slice(1).filter((f) => !x.expected.includes(f.bggId)).length, 0)}`,
        ocr,
      ].join(" · ");
    })
    .concat(
      (({ score, right, wrong, possible, photos }) =>
        `${model.padEnd(6)} OVERALL · score ${score} (right ${right} of ${possible} − 2 × wrong ${wrong}) · ${photos} photos`)(
        overall(rows),
      ),
    )
    .join("\n");
}

function report(model: string, rows: Row[]) {
  const lines = [`# PP-OCRv6 ${model}`, "", "```", summary(model, rows), "```", ""];
  const label = (r: Row) => r.expected.map((id) => nameOf.get(id) ?? `#${id}`).join(" + ");
  for (const set of [...new Set(rows.map((r) => r.set))]) {
    lines.push(`## ${set}`, "", "| On the photo | Title read | Main queries | Games shown | Main right game at |", "|---|---|---|---|---|");
    for (const r of rows.filter((x) => x.set === set).sort((a, b) => label(a).localeCompare(label(b)))) {
      const shown = r.found.map((f) => (r.expected.includes(f.bggId) ? f.name : `~~${f.name}~~`)).join(", ") || "—";
      lines.push(`| ${label(r)} | ${r.read ? "✅" : "—"} | ${r.queries.join(" / ") || "—"} | ${shown} (${r.decision}) | ${r.rank ? `#${r.rank}` : "❌"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
