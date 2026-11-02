import { refreshHotGames } from "@/lib/game/refresh";

// 3 BGG calls with a 1 s pause between them.
export const maxDuration = 60;

/**
 * Daily Vercel Cron (vercel.json): refreshes BGG's hot list, so new releases are in the name index within a
 * day. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await refreshHotGames());
}
