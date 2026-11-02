import type { NextRequest } from "next/server";

import { refreshTopGames } from "@/lib/game/refresh";

// ~55 BGG calls with a 1 s pause between them.
export const maxDuration = 300;

/**
 * Weekly Vercel Cron (vercel.json): refreshes the top 1000 games and BGG's hot list. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; `?top=` overrides the count for a manual run.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const top = Math.min(Math.max(Number(request.nextUrl.searchParams.get("top")) || 1000, 1), 5000);
  return Response.json(await refreshTopGames(top));
}
