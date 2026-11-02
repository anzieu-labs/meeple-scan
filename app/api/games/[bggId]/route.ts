import { getGames } from "@/lib/game/games";

/** `GET /api/games/:bggId` — one game card, e.g. to reopen a game from the history. */
export async function GET(_request: Request, { params }: RouteContext<"/api/games/[bggId]">) {
  const bggId = Number((await params).bggId);
  if (!Number.isInteger(bggId) || bggId <= 0) return Response.json({ error: "Not a BGG id" }, { status: 400 });
  const [game] = await getGames([bggId]);
  if (!game) return Response.json({ error: "Unknown BGG game" }, { status: 404 });
  // Game data is refreshed weekly: the CDN can keep a card for a day.
  return Response.json({ game }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
