/**
 * Imports BGG's ranks dump into the `game_names` index.
 *
 *   pnpm import:ranks data/bgg-ranks/boardgames_ranks_2026-10-30.zip
 *
 * Download the zip from https://boardgamegeek.com/data_dumps/bg_ranks while logged in (the link expires
 * after 10 minutes). Keeps ranked games plus expansions with at least 50 ratings; re-running updates
 * names, ranks and rating counts in place.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import pg from "pg";

import { normalizeName } from "../lib/matching/rank.ts";
import { parseCsv } from "../lib/csv.ts";

const MIN_EXPANSION_RATINGS = 50;
const BATCH = 2000;

const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm import:ranks <boardgames_ranks.zip | boardgames_ranks.csv>");
  process.exit(1);
}

const csv = file.endsWith(".zip")
  ? execFileSync("unzip", ["-p", file, "boardgames_ranks.csv"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8")
  : readFileSync(file, "utf8");

const rows = parseCsv(csv)
  .map((r) => ({
    bggId: Number(r.id),
    name: r.name,
    normalized: normalizeName(r.name),
    rank: Number(r.rank) || null,
    usersRated: Number(r.usersrated) || 0,
    year: Number(r.yearpublished) || null,
    isExpansion: r.is_expansion === "1",
  }))
  .filter((r) => r.normalized && (r.rank || (r.isExpansion && r.usersRated >= MIN_EXPANSION_RATINGS)));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
const started = Date.now();
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  await client.query(
    `insert into game_names (bgg_id, name, normalized, is_primary, is_expansion, rank, users_rated, year_published)
     select id, name, normalized, true, expansion, rank, rated, year
     from unnest($1::int[], $2::text[], $3::text[], $4::bool[], $5::int[], $6::int[], $7::int[])
       as t(id, name, normalized, expansion, rank, rated, year)
     on conflict (bgg_id, normalized) do update set
       name = excluded.name, is_primary = true, is_expansion = excluded.is_expansion, rank = excluded.rank,
       users_rated = excluded.users_rated, year_published = excluded.year_published, updated_at = now()`,
    [
      batch.map((r) => r.bggId),
      batch.map((r) => r.name),
      batch.map((r) => r.normalized),
      batch.map((r) => r.isExpansion),
      batch.map((r) => r.rank),
      batch.map((r) => r.usersRated),
      batch.map((r) => r.year),
    ],
  );
  process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length} names`);
}
const { rows: totals } = await client.query(
  "select count(*)::int as names, count(*) filter (where rank is not null)::int as ranked from game_names",
);
await client.end();
console.log(`\nImported in ${((Date.now() - started) / 1000).toFixed(1)}s · game_names now has`, totals[0]);
