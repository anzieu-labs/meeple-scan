/**
 * Sends the evaluation photos to Gemini with the app's own prompt and model, and saves what it named, for
 * evaluate.test.ts:  pnpm eval:gemini <run> [set,set…]
 *
 * Reads data/<set>/*.jpg and writes out/<run>/<set>/<photo>.json ({ games, seconds }). Photos already
 * answered are skipped, so an interrupted run picks up where it stopped. GEMINI_MODEL picks another model
 * (one run per model). Photos are sent as stored (at most 1600 px), not shrunk to the app's 1280 px.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readGameNames } from "../lib/gemini/client.ts";

const DATA = join(import.meta.dirname, "data");
const OUT = join(import.meta.dirname, "out");
const [run, only] = process.argv.slice(2);
if (!run) {
  console.error("Usage: pnpm eval:gemini <run> [set,set…]");
  process.exit(1);
}
const sets = readdirSync(DATA, { withFileTypes: true })
  .filter((d) => d.isDirectory() && (!only || only.split(",").includes(d.name)))
  .map((d) => d.name);

for (const set of sets) {
  mkdirSync(join(OUT, run, set), { recursive: true });
  const photos = readdirSync(join(DATA, set)).filter((f) => f.endsWith(".jpg"));
  let asked = 0;
  for (const photo of photos) {
    const target = join(OUT, run, set, photo.replace(/\.jpg$/, ".json"));
    if (existsSync(target)) continue;
    const image = readFileSync(join(DATA, set, photo));
    const start = performance.now();
    try {
      const games = await readGameNames(image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength), "image/jpeg");
      writeFileSync(target, JSON.stringify({ games, seconds: Number(((performance.now() - start) / 1000).toFixed(3)) }));
      asked++;
    } catch (error) {
      console.warn(`${set}/${photo}: ${String(error)}`);
    }
  }
  console.log(`${set}: ${asked} photos asked, ${photos.length - asked} already answered or failed`);
}
