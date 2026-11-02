import { addCorrection, isBggId, isPhotoLogId } from "@/lib/game/photo-log";

/**
 * `POST /api/photo-logs/:id/corrections` with `{ from, to, via }`: the game the user picked after a photo,
 * instead of `from`, or as a game on the photo that wasn't found (`from: null`).
 */
export async function POST(request: Request, { params }: RouteContext<"/api/photo-logs/[id]/corrections">) {
  const { id } = await params;
  if (!isPhotoLogId(id)) return Response.json({ error: "Not a photo id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { from?: unknown; to?: unknown; via?: unknown } | null;
  if (
    !body ||
    !isBggId(body.to) ||
    !(body.from === null || isBggId(body.from)) ||
    (body.via !== "alternative" && body.via !== "search")
  ) {
    return Response.json({ error: "Send { from: BGG id or null, to: BGG id, via: 'alternative' | 'search' }" }, { status: 400 });
  }
  const found = await addCorrection(id, { from: body.from as number | null, to: body.to, via: body.via });
  return found ? new Response(null, { status: 204 }) : Response.json({ error: "Unknown photo" }, { status: 404 });
}
