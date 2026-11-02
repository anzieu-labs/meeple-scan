/**
 * Turns the photo log into evaluation data: one file per photo in ocr-eval/out/small/real/, named after
 * the games really on it (what was shown, with the user's corrections applied), for ocr-eval/evaluate.test.ts.
 *
 *   pnpm export:photo-logs          photos where every game was marked right or picked (the app asks for each)
 *   pnpm export:photo-logs --all    every photo, games nobody answered counted as right (older photos, from
 *                                   before the app asked, are mostly unanswered)
 *
 * It also prints how often the main game shown was right, per reader (Gemini, or OCR when Gemini matched
 * nothing), from the users' answers.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

import type { PhotoCorrection } from "../db/schema.ts";
import type { OcrLine } from "../lib/matching/cover.ts";
import type { VisionGame } from "../lib/matching/vision-match.ts";

const OUT = join(import.meta.dirname, "..", "ocr-eval", "out", "small", "real");
/** Gemini's answer for the same photos, for GEMINI=gemini-app GEMINI_ALWAYS=1 in the evaluation. */
const VISION_OUT = join(import.meta.dirname, "..", "ocr-eval", "out", "gemini-app", "real");
const all = process.argv.includes("--all");

/** The games on the photo: shown ones, each correction replacing the game it corrected (or adding one). */
function gamesOnPhoto(shown: { bggId: number }[], corrections: PhotoCorrection[]) {
  const games = shown.map((g) => g.bggId);
  for (const { from, to } of corrections) {
    const at = from === null ? -1 : games.indexOf(from);
    if (at >= 0) games[at] = to;
    else games.unshift(to);
  }
  return [...new Set(games)];
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query<{
  id: string;
  lines: OcrLine[];
  vision: VisionGame[] | null;
  source: "gemini" | "ocr" | null;
  shown: { bggId: number }[];
  corrections: PhotoCorrection[];
  confirmed: number[];
}>(`select id, lines, vision, source, shown, corrections, confirmed from photo_logs order by created_at`);
await db.end();

for (const dir of [OUT, VISION_OUT]) {
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) rmSync(join(dir, file));
}
let written = 0;
let checked = 0;
for (const row of rows) {
  const games = gamesOnPhoto(row.shown, row.corrections);
  if (!games.length) continue; // Nothing found and nothing picked: no label.
  const allChecked = games.every((id) => row.confirmed.includes(id) || row.corrections.some((c) => c.to === id));
  if (allChecked) checked++;
  if (!all && !allChecked) continue;
  // "13-822~1a2b3c4d.json": the evaluation reads the ids before "~"; the suffix keeps repeated games apart.
  const file = `${games.join("-")}~${row.id.slice(0, 8)}.json`;
  writeFileSync(join(OUT, file), JSON.stringify({ seconds: 0, lines: row.lines }));
  if (row.vision) writeFileSync(join(VISION_OUT, file), JSON.stringify({ games: row.vision }));
  written++;
}
console.log(`${written} photos written to ${OUT} (${checked} fully checked by the user)`);

/** Per reader: the main game shown was marked right, replaced by the user, or left unanswered. */
const answers = new Map<string, { right: number; wrong: number; unanswered: number }>();
for (const row of rows) {
  const main = row.shown[0]?.bggId;
  if (!row.source || main === undefined) continue;
  const tally = answers.get(row.source) ?? { right: 0, wrong: 0, unanswered: 0 };
  if (row.confirmed.includes(main)) tally.right++;
  else if (row.corrections.some((c) => c.from === main)) tally.wrong++;
  else tally.unanswered++;
  answers.set(row.source, tally);
}
for (const [source, { right, wrong, unanswered }] of answers) {
  const answered = right + wrong;
  const share = answered ? ` (${Math.round((100 * right) / answered)}% of answered)` : "";
  console.log(`${source}: main game right ${right}, wrong ${wrong}${share}, unanswered ${unanswered}`);
}
