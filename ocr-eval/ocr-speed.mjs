/**
 * Measures a deployed OCR service's speed: sends evaluation images one at a time, like the app does, and
 * reports the service's own reading time and the full round trip.
 *
 *   node --env-file=.env.local ocr-eval/ocr-speed.mjs https://ocr.example.com [KEY_ENV_VAR] [count]
 *
 * The API key is read from the environment variable named KEY_ENV_VAR (default OCR_API_KEY), never typed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [url, keyVar = "OCR_API_KEY", count = "20"] = process.argv.slice(2);
const key = process.env[keyVar];
if (!url || !key) {
  console.error("Usage: node --env-file=.env.local ocr-eval/ocr-speed.mjs <service url> [KEY_ENV_VAR] [count]");
  process.exit(1);
}

const data = join(import.meta.dirname, "data");
// A spread of covers, phone-like copies and shelves, the same ones every run.
const images = ["covers", "phone", "shelves"].flatMap((set) =>
  readdirSync(join(data, set))
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .filter((_, i) => i % 6 === 0)
    .map((f) => join(data, set, f)),
);

const server = [];
const total = [];
for (const path of images.slice(0, Number(count))) {
  const started = performance.now();
  const res = await fetch(`${url.replace(/\/$/, "")}/ocr`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "image/jpeg" },
    body: readFileSync(path),
  });
  const elapsed = (performance.now() - started) / 1000;
  if (!res.ok) {
    console.error(`${path}: HTTP ${res.status}`);
    continue;
  }
  const body = await res.json();
  server.push(body.seconds);
  total.push(elapsed);
  console.log(`${path.split("/").slice(-2).join("/")}: read ${body.seconds.toFixed(2)}s, round trip ${elapsed.toFixed(2)}s, ${body.lines.length} lines`);
}

const stats = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(2);
  return `avg ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)}s · median ${at(0.5)}s · 90th percentile ${at(0.9)}s`;
};
console.log(`\n${url} (${server.length} images)\n  reading:    ${stats(server)}\n  round trip: ${stats(total)}`);
