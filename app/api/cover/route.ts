import { recognizeCover } from "@/lib/game/cover";
import type { CoverEvent } from "@/lib/game/types";

// Gemini (~1.5 s) and OCR (~1–5 s on the VPS) side by side, plus a BGG search per game on the photo.
export const maxDuration = 60;

/** Vercel caps request bodies at 4.5 MB; the phone sends a ~1280 px JPEG (~150–300 KB). */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * `POST /api/cover` with a photo of the box (or of several) as the raw body: finds the games from what's
 * written on them. Streams newline-delimited JSON (`CoverEvent`): each game as soon as it's found, then the
 * result, so the phone shows the first game while the others are still being looked up.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
    return Response.json({ error: "Send a JPEG, PNG or WebP image as the body" }, { status: 415 });
  }
  const image = await request.arrayBuffer();
  if (!image.byteLength) return Response.json({ error: "Empty image" }, { status: 400 });
  if (image.byteLength > MAX_BYTES) return Response.json({ error: "Image larger than 4 MB" }, { status: 413 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CoverEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await recognizeCover(image, contentType, (game, more, logId) => send({ type: "game", game, more, logId }));
        send({ type: "done", result });
      } catch (error) {
        console.error("Photo lookup failed", error);
        send({ type: "error" });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
