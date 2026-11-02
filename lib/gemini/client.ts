import "server-only";

import type { VisionGame } from "@/lib/matching/vision-match";

/** Usually ~1.5 s; past this, OCR's answer is used alone. */
const TIMEOUT_MS = 8_000;
/** Read titles as well as the bigger models on the evaluation photos, at ~$0.0004 a photo. */
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export class GeminiError extends Error {}

const PROMPT =
  "This photo shows one or more board game boxes. For each board game box you can see, the biggest or most " +
  "central box first, give its title as printed on the box (with subtitle or edition if printed) and the " +
  "game's primary name on BoardGameGeek (usually English). Only list a game you can identify with " +
  "confidence; if you can't, return an empty list.";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    games: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { printed: { type: "STRING" }, bgg: { type: "STRING" } },
        required: ["printed", "bgg"],
      },
    },
  },
  required: ["games"],
};

/** Whether a Gemini key is set; without one, photos are matched from OCR alone. */
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

/**
 * Asks Gemini which board games are on a photo, the biggest box first: each title as printed and its
 * BoardGameGeek name. An empty list means it recognized nothing.
 */
export async function readGameNames(image: ArrayBuffer, contentType: string): Promise<VisionGame[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { parts: [{ inline_data: { mime_type: contentType, data: Buffer.from(image).toString("base64") } }, { text: PROMPT }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new GeminiError(`Gemini unreachable: ${String(error)}`);
  });
  if (!res.ok) throw new GeminiError(`Gemini answered ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) return [];
  try {
    const { games } = JSON.parse(text) as { games?: unknown };
    return (Array.isArray(games) ? games : []).filter(
      (g): g is VisionGame => typeof g?.printed === "string" && typeof g?.bgg === "string",
    );
  } catch {
    throw new GeminiError(`Gemini sent unreadable JSON: ${text.slice(0, 200)}`);
  }
}
