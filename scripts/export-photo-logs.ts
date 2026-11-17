/**
 * Turns the photo log into evaluation data: one file per photo in recognition-eval/out/gemini-app/real/,
 * with the games Gemini named, named after the games really on it (what was shown, with the user's
 * corrections applied), for recognition-eval/evaluate.test.ts.
 *
 *   pnpm export:photo-logs          photos where every game was marked right or picked (the app asks for each)
 *   pnpm export:photo-logs --all    every photo, games nobody answered counted as right (older photos, from
 *                                   before the app asked, are mostly unanswered)
 *
 * It also prints how often the main game shown was right, from the users' answers.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

import type { PhotoCorrection } from "../db/schema.ts";
import type { VisionGame } from "../lib/matching/vision-match.ts";

const OUT = join(import.meta.dirname, "..", "recognition-eval", "out", "gemini-app", "real");
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
  vision: VisionGame[] | null;
  shown: { bggId: number }[];
  corrections: PhotoCorrection[];
  confirmed: number[];
}>(`select id, vision, shown, corrections, confirmed from photo_logs order by created_at`);
await db.end();

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) rmSync(join(OUT, file));
let written = 0;
let checked = 0;
for (const row of rows) {
  if (!row.vision) continue; // From before Gemini was asked: nothing to replay.
  const games = gamesOnPhoto(row.shown, row.corrections);
  if (!games.length) continue; // Nothing found and nothing picked: no label.
  const allChecked = games.every((id) => row.confirmed.includes(id) || row.corrections.some((c) => c.to === id));
  if (allChecked) checked++;
  if (!all && !allChecked) continue;
  // "13-822~1a2b3c4d.json": the evaluation reads the ids before "~"; the suffix keeps repeated games apart.
  writeFileSync(join(OUT, `${games.join("-")}~${row.id.slice(0, 8)}.json`), JSON.stringify({ games: row.vision }));
  written++;
}
console.log(`${written} photos written to ${OUT} (${checked} fully checked by the user)`);

/** The main game shown was marked right, replaced by the user, or left unanswered. */
let [right, wrong, unanswered] = [0, 0, 0];
for (const row of rows) {
  const main = row.shown[0]?.bggId;
  if (main === undefined) continue;
  if (row.confirmed.includes(main)) right++;
  else if (row.corrections.some((c) => c.from === main)) wrong++;
  else unanswered++;
}
const answered = right + wrong;
const share = answered ? ` (${Math.round((100 * right) / answered)}% of answered)` : "";
console.log(`main game right ${right}, wrong ${wrong}${share}, unanswered ${unanswered}`);
