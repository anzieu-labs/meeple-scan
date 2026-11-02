import { count, sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { gameNames, games } from "@/db/schema";

/** Proves the database is reachable and migrated: server time plus a row count per table. */
export async function GET() {
  await connection();
  try {
    const [{ now }] = (await db.execute<{ now: string }>(sql`select now()::text as now`)).rows;
    const tables = { games, game_names: gameNames };
    const rows = Object.fromEntries(
      await Promise.all(
        Object.entries(tables).map(async ([name, table]) => [name, (await db.select({ n: count() }).from(table))[0].n]),
      ),
    );
    return Response.json({ ok: true, databaseTime: now, rows });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
