import "server-only";

import type { OcrLine } from "@/lib/matching/cover";

const TIMEOUT_MS = 25_000;

export class OcrError extends Error {}

/** Sends a box photo to the self-hosted PaddleOCR service (ocr-service/) and returns the text lines it read. */
export async function readCover(image: ArrayBuffer, contentType: string): Promise<{ lines: OcrLine[]; seconds: number }> {
  const url = process.env.OCR_URL;
  const key = process.env.OCR_API_KEY;
  if (!url || !key) throw new OcrError("OCR_URL and OCR_API_KEY must be set");

  const res = await fetch(`${url.replace(/\/$/, "")}/ocr`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": contentType },
    body: image,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new OcrError(`OCR service unreachable: ${String(error)}`);
  });
  if (!res.ok) throw new OcrError(`OCR service answered ${res.status}`);
  const body = (await res.json()) as { lines: OcrLine[]; seconds: number };
  return { lines: body.lines, seconds: body.seconds };
}
