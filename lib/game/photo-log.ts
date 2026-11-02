import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { photoLogs, type PhotoCorrection } from "@/db/schema";
import type { OcrLine } from "@/lib/matching/cover";
import type { VisionGame } from "@/lib/matching/vision-match";

import type { CoverGame } from "./types";

/**
 * Keeps what a photo was read as (OCR lines, the games Gemini named) and which games were shown, for tuning
 * the matcher later.
 */
export async function logPhoto(
  id: string,
  { lines, vision, source }: { lines: OcrLine[]; vision: VisionGame[] | null; source: "gemini" | "ocr" },
  games: CoverGame[],
) {
  try {
    await db.insert(photoLogs).values({
      id,
      lines: lines.map(({ text, score, box }) => ({ text, score, box })),
      vision,
      source,
      shown: games.map((g) => ({ bggId: g.game.bggId, match: g.match })),
    });
  } catch (error) {
    // Losing a log row must never break a lookup.
    console.error("Photo log failed", error);
  }
}

/** Adds the game the user picked after a photo. False when there's no such photo. */
export async function addCorrection(id: string, correction: Omit<PhotoCorrection, "at">) {
  const entry: PhotoCorrection = { ...correction, at: new Date().toISOString() };
  const updated = await db
    .update(photoLogs)
    .set({ corrections: sql`${photoLogs.corrections} || ${JSON.stringify([entry])}::jsonb` })
    .where(eq(photoLogs.id, id))
    .returning({ id: photoLogs.id });
  return updated.length > 0;
}

/** Marks a shown game as the right one for the photo (once). False when there's no such photo. */
export async function addConfirmation(id: string, bggId: number) {
  const updated = await db
    .update(photoLogs)
    .set({
      confirmed: sql`case when ${bggId} = any(${photoLogs.confirmed}) then ${photoLogs.confirmed} else array_append(${photoLogs.confirmed}, ${bggId}) end`,
    })
    .where(eq(photoLogs.id, id))
    .returning({ id: photoLogs.id });
  return updated.length > 0;
}

/** Photo-log ids are UUIDs (crypto.randomUUID()). */
export const isPhotoLogId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const isBggId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
