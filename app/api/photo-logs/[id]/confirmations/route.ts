import { addConfirmation, isBggId, isPhotoLogId } from "@/lib/game/photo-log";

/** `POST /api/photo-logs/:id/confirmations` with `{ bggId }`: the user says this game really is on the photo. */
export async function POST(request: Request, { params }: RouteContext<"/api/photo-logs/[id]/confirmations">) {
  const { id } = await params;
  if (!isPhotoLogId(id)) return Response.json({ error: "Not a photo id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { bggId?: unknown } | null;
  if (!isBggId(body?.bggId)) return Response.json({ error: "Send { bggId: BGG id }" }, { status: 400 });
  const found = await addConfirmation(id, body.bggId);
  return found ? new Response(null, { status: 204 }) : Response.json({ error: "Unknown photo" }, { status: 404 });
}
