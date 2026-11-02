/**
 * What visits come from and what they do, from the usage events (lib/events) and the photo log:
 *
 *   pnpm stats        the last 30 days
 *   pnpm stats 7      the last 7 days
 *
 * A visit is one page load. "Scanned" visits sent at least one photo; that share, per source, is how well a
 * post or a link brings people who actually use the app.
 */
import pg from "pg";

const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days < 1) throw new Error("Usage: pnpm stats [days]");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const since = `now() - interval '${days} days'`;
const query = async (sql: string) => (await db.query(sql)).rows;

console.log(`\nMeeple Scan, the last ${days} days\n`);

console.log("Visits, and how many scanned, by source (ref= or utm_source=, else the site they came from)");
console.table(
  await query(`
    with visits as (
      select visit, coalesce(nullif(props->>'ref', ''), nullif(props->>'referrer', ''), '(direct)') as source,
             props->>'device' as device
      from events where name = 'visit' and created_at > ${since}
    ),
    scanned as (select distinct visit from events where name = 'photo' and created_at > ${since})
    select source,
           count(*)::int as visits,
           count(*) filter (where device = 'phone')::int as phone,
           count(*) filter (where device = 'computer')::int as computer,
           count(s.visit)::int as scanned,
           round(100.0 * count(s.visit) / count(*))::int as "scanned %"
    from visits v left join scanned s using (visit)
    group by source order by visits desc limit 20`),
);

console.log("Every day");
console.table(
  await query(`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
           count(*) filter (where name = 'visit')::int as visits,
           count(*) filter (where name = 'visit' and (props->>'installed')::boolean)::int as "from home screen",
           count(*) filter (where name = 'photo' and props->>'source' = 'camera')::int as "camera photos",
           count(*) filter (where name = 'photo' and props->>'source' = 'gallery')::int as "gallery photos",
           count(*) filter (where name = 'install')::int as installs
    from events where created_at > ${since}
    group by 1 order by 1`),
);

console.log("Visits by language");
console.table(
  await query(`
    select locale, count(*)::int as visits from events
    where name = 'visit' and created_at > ${since} group by locale order by visits desc`),
);

console.log("Photos read, and the users' answers");
console.table(
  await query(`
    select count(*)::int as photos,
           count(*) filter (where jsonb_array_length(shown) = 0)::int as "nothing found",
           count(*) filter (where cardinality(confirmed) > 0)::int as "marked right",
           count(*) filter (where jsonb_array_length(corrections) > 0)::int as corrected
    from photo_logs where created_at > ${since}`),
);

const [{ count }] = await query(`select count(*)::int as count from feedback where created_at > ${since}`);
console.log(`Feedback messages: ${count} (read them with pnpm db:studio)\n`);

await db.end();
