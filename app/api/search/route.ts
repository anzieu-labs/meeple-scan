import type { NextRequest } from "next/server";

import { searchGames } from "@/lib/game/search";

/** `GET /api/search?q=` — manual game search by name. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return Response.json({ error: "Search with 2 to 100 characters" }, { status: 400 });
  }
  // Same answer for everyone: the CDN keeps it an hour, which also spares BGG's rate limit.
  return Response.json(
    { games: await searchGames(query) },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
