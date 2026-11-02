import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/** The windows the headline figures are counted over, in days (1 = since midnight UTC). */
export const WINDOWS = [1, 7, 30] as const;

export type Totals = {
  visits: number;
  phone: number;
  scannedVisits: number;
  photos: number;
  gallery: number;
  installs: number;
  logged: number;
  nothingFound: number;
  markedRight: number;
  corrected: number;
  feedback: number;
};

const since = (days: number) => (days === 1 ? sql`date_trunc('day', now())` : sql`now() - make_interval(days => ${days})`);

const rows = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];

/** Usage events, photo logs and feedback over the last `days` days. */
async function totals(days: number): Promise<Totals> {
  const [row] = await rows<Record<keyof Totals, string>>(sql`
    select
      (select count(*) from events where name = 'visit' and created_at > ${since(days)}) as visits,
      (select count(*) from events where name = 'visit' and props->>'device' = 'phone' and created_at > ${since(days)}) as phone,
      (select count(distinct visit) from events where name = 'photo' and created_at > ${since(days)}) as "scannedVisits",
      (select count(*) from events where name = 'photo' and created_at > ${since(days)}) as photos,
      (select count(*) from events where name = 'photo' and props->>'source' = 'gallery' and created_at > ${since(days)}) as gallery,
      (select count(*) from events where name = 'install' and created_at > ${since(days)}) as installs,
      (select count(*) from photo_logs where created_at > ${since(days)}) as logged,
      (select count(*) from photo_logs where jsonb_array_length(shown) = 0 and created_at > ${since(days)}) as "nothingFound",
      (select count(*) from photo_logs where cardinality(confirmed) > 0 and created_at > ${since(days)}) as "markedRight",
      (select count(*) from photo_logs where jsonb_array_length(corrections) > 0 and created_at > ${since(days)}) as corrected,
      (select count(*) from feedback where created_at > ${since(days)}) as feedback`);
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) as Totals;
}

export type Day = { day: string; visits: number; phone: number; photos: number; installs: number };
export type Source = { source: string; visits: number; phone: number; scanned: number };
export type Language = { locale: string; visits: number };
export type TopGame = { name: string; bggId: number; times: number };
export type Feedback = { at: string; locale: string; message: string; email: string | null };

/** Everything the stats page shows, read now (no cache). */
export async function readStats() {
  const [windows, days, sources, languages, topGames, feedback] = await Promise.all([
    Promise.all(WINDOWS.map(totals)),
    rows<Day>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
             count(e.*) filter (where e.name = 'visit')::int as visits,
             count(e.*) filter (where e.name = 'visit' and e.props->>'device' = 'phone')::int as phone,
             count(e.*) filter (where e.name = 'photo')::int as photos,
             count(e.*) filter (where e.name = 'install')::int as installs
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as d
      left join events e on date_trunc('day', e.created_at) = d
      group by d order by d`),
    rows<Source>(sql`
      with visits as (
        select visit, coalesce(nullif(props->>'ref', ''), nullif(props->>'referrer', ''), '(direct)') as source, props->>'device' as device
        from events where name = 'visit' and created_at > now() - interval '30 days'
      ), scanned as (select distinct visit from events where name = 'photo' and created_at > now() - interval '30 days')
      select source, count(*)::int as visits, count(*) filter (where device = 'phone')::int as phone, count(s.visit)::int as scanned
      from visits v left join scanned s using (visit)
      group by source order by visits desc limit 25`),
    rows<Language>(sql`
      select locale, count(*)::int as visits from events
      where name = 'visit' and created_at > now() - interval '30 days' group by locale order by visits desc`),
    rows<TopGame>(sql`
      select g.name, g.bgg_id as "bggId", count(*)::int as times
      from photo_logs p cross join lateral unnest(p.confirmed) as c(bgg_id) join games g on g.bgg_id = c.bgg_id
      where p.created_at > now() - interval '30 days'
      group by g.bgg_id, g.name order by times desc limit 10`),
    rows<Feedback>(sql`
      select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as at, locale, message, email
      from feedback order by created_at desc limit 30`),
  ]);
  return { windows, days, sources, languages, topGames, feedback, readAt: new Date().toISOString() };
}

export type Stats = Awaited<ReturnType<typeof readStats>>;
