/**
 * Scores photo recognition end to end: does Gemini name the game, and does the matcher find the right BGG
 * game from what it named? Run after run-gemini.ts (or pnpm export:photo-logs), with BGG_API_TOKEN and
 * DATABASE_URL set:  RECOGNITION_EVAL=1 pnpm exec vitest run recognition-eval
 * BGG searches are cached in out/bgg-cache.json, so reruns are fast and only new queries hit BGG; game
 * details come from the app's own cache in Neon, like in production.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { searchBgg } from "@/lib/bgg/client";
import { getGames } from "@/lib/game/games";
import { searchNameIndex } from "@/lib/game/name-index";
import type { BggSource } from "@/lib/matching/match";
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
// search off (index only, fast); RUNS=a,b limits the Gemini runs evaluated (folders of out/);
// SETS=covers,gallery limits the photo sets; SPLIT=tune|holdout keeps one half of the games (split.py);
// REPORT=name writes out/report-<name>.md instead of report-<run>.md, for runs of one model side by side.
const useNameIndex = process.env.NAME_INDEX !== "0";
const useBggSearch = process.env.BGG_SEARCH !== "0";
const bgg: BggSource = {
  search: (q, { exact }) =>
    useBggSearch ? cached(`search ${exact ? "exact" : "fuzzy"} ${q}`, () => retryThrottled(() => searchBgg(q, { exact }))) : Promise.resolve([]),
  fetchGames: (ids) => retryThrottled(() => getGames(ids)),
  searchNames: useNameIndex ? (q) => searchNameIndex(q) : undefined,
};

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

interface Row {
  set: string;
  /** BGG ids on the picture: one for a cover, 2–3 for a shelf ("13-822-9209"). */
  expected: number[];
  /** What Gemini named, as printed. */
  named: string[];
  /** Games shown: the main one, then the extras. */
  found: { bggId: number; name: string }[];
  /** What the app shows: the main game unless nothing matched well enough. */
  mainShown: number | null;
  extrasShown: number[];
  /** 1-based position of the first expected game among the main match's candidates, 0 = not in the top 5. */
  rank: number;
  decision: string;
  seconds: number | null;
}

it("evaluates photo recognition", async () => {
  expect(process.env.BGG_API_TOKEN, "BGG_API_TOKEN must be set").toBeTruthy();
  const only = process.env.RUNS?.split(",");
  const sets = process.env.SETS?.split(",");
  const split = process.env.SPLIT;
  const runs = readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!only || only.includes(d.name)))
    .map((d) => d.name);

  for (const run of runs) {
    const rows: Row[] = [];
    for (const set of readdirSync(join(OUT, run)).filter((s) => !sets || sets.includes(s))) {
      for (const file of readdirSync(join(OUT, run, set)).filter((f) => f.endsWith(".json"))) {
        const expected = file.replace(".json", "").split("-").map((id) => Number.parseInt(id, 10));
        if (split && !expected.every((id) => halfOf(id) === split)) continue;
        // A game is { printed, bgg }, or a title as printed (the first prompt), searched alone.
        const answer = JSON.parse(readFileSync(join(OUT, run, set, file), "utf8")) as { games: (string | VisionGame)[]; seconds?: number };
        const games = answer.games.map((g) => (typeof g === "string" ? { printed: g, bgg: g } : g));
        const match = await matchVisionGames(games, bgg);
        const main = match?.main;
        const extras = match?.extras ?? [];
        const rank = (main?.ranked.findIndex((c) => expected.includes(c.game.bggId)) ?? -1) + 1;
        rows.push({
          set,
          expected,
          named: games.map((g) => g.printed),
          found: [main, ...extras].flatMap((m) => m?.ranked.slice(0, 1).map((c) => ({ bggId: c.game.bggId, name: c.game.name })) ?? []),
          mainShown: !main || main.decision === "none" ? null : (main.ranked[0]?.game.bggId ?? null),
          extrasShown: extras.map((m) => m.ranked[0].game.bggId),
          rank: rank > 5 ? 0 : rank,
          decision: main?.decision ?? "none",
          seconds: answer.seconds ?? null,
        });
      }
    }
    writeFileSync(join(OUT, `report-${process.env.REPORT ?? run}.md`), report(run, rows));
    console.log(summary(run, rows));
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

function summary(run: string, rows: Row[]) {
  const sets = [...new Set(rows.map((r) => r.set))];
  return sets
    .map((set) => {
      const r = rows.filter((x) => x.set === set);
      const secs = r.flatMap((x) => (x.seconds === null ? [] : [x.seconds]));
      const time = secs.length ? [`Gemini ${(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(2)}s avg`] : [];
      if (isShelfSet(set)) {
        const expected = r.reduce((n, x) => n + x.expected.length, 0);
        const found = r.reduce((n, x) => n + x.found.filter((f) => x.expected.includes(f.bggId)).length, 0);
        const wrong = r.reduce((n, x) => n + falseFinds(x).length, 0);
        return [`${run.padEnd(6)} ${set.padEnd(7)}`, `games found ${pct(found, expected)}`, `wrong games shown ${wrong}`, ...time].join(" · ");
      }
      return [
        `${run.padEnd(6)} ${set.padEnd(7)}`,
        `named something ${pct(r.filter((x) => x.named.length).length, r.length)}`,
        `top-1 ${pct(r.filter((x) => x.rank === 1).length, r.length)}`,
        `top-5 ${pct(r.filter((x) => x.rank > 0).length, r.length)}`,
        `false extra games ${r.reduce((n, x) => n + x.found.slice(1).filter((f) => !x.expected.includes(f.bggId)).length, 0)}`,
        ...time,
      ].join(" · ");
    })
    .concat(
      (({ score, right, wrong, possible, photos }) =>
        `${run.padEnd(6)} OVERALL · score ${score} (right ${right} of ${possible} − 2 × wrong ${wrong}) · ${photos} photos`)(
        overall(rows),
      ),
    )
    .join("\n");
}

function report(run: string, rows: Row[]) {
  const lines = [`# ${run}`, "", "```", summary(run, rows), "```", ""];
  const label = (r: Row) => r.expected.map((id) => nameOf.get(id) ?? `#${id}`).join(" + ");
  for (const set of [...new Set(rows.map((r) => r.set))]) {
    lines.push(`## ${set}`, "", "| On the photo | Gemini named | Games shown | Main right game at |", "|---|---|---|---|");
    for (const r of rows.filter((x) => x.set === set).sort((a, b) => label(a).localeCompare(label(b)))) {
      const shown = r.found.map((f) => (r.expected.includes(f.bggId) ? f.name : `~~${f.name}~~`)).join(", ") || "—";
      lines.push(`| ${label(r)} | ${r.named.join(" / ") || "—"} | ${shown} (${r.decision}) | ${r.rank ? `#${r.rank}` : "❌"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
