import type { Page } from "@playwright/test";

import type { CoverEvent, CoverResult, GameCard } from "@/lib/game/types";

/** Minimal game card with sensible defaults. */
export function game(overrides: Partial<GameCard> & Pick<GameCard, "bggId" | "name">): GameCard {
  return {
    type: "boardgame",
    alternateNames: [],
    yearPublished: 2000,
    thumbnail: null,
    image: null,
    ratingAverage: 7.5,
    ratingBayes: 7.2,
    usersRated: 50_000,
    rank: 100,
    weight: 2.3,
    numWeights: 1000,
    minPlayers: 2,
    maxPlayers: 4,
    bestPlayers: [3],
    recommendedPlayers: [2, 3, 4],
    playerVotes: [],
    minAge: 10,
    communityAge: 10,
    minPlayTime: 30,
    maxPlayTime: 60,
    mechanics: [],
    categories: [],
    publishers: [],
    fetchedAt: new Date().toISOString() as unknown as Date,
    ...overrides,
  };
}

/**
 * Serves `POST /api/cover` with canned answers (one per photo, in order; the last one repeats) and
 * `GET /api/games/:id` from the games they contain, so browser tests never call the OCR server or BGG.
 * Returns the uploads received.
 */
export async function fakeApi(page: Page, ...answers: CoverResult[]) {
  const uploads: { type: string; bytes: number; body: Buffer | null }[] = [];
  const known = new Map<number, GameCard>();
  for (const answer of answers) {
    if (answer.status !== "matched") continue;
    for (const g of answer.games) [g.game, ...g.alternatives].forEach((card) => known.set(card.bggId, card));
  }
  await page.route("**/api/cover", async (route) => {
    const body = route.request().postDataBuffer();
    uploads.push({ type: route.request().headers()["content-type"], bytes: body?.length ?? 0, body });
    const answer = answers[Math.min(uploads.length, answers.length) - 1];
    await route.fulfill({ body: coverStream(answer), contentType: "application/x-ndjson" });
  });
  await page.route("**/api/games/*", async (route) => {
    const card = known.get(Number(new URL(route.request().url()).pathname.split("/").at(-1)));
    await route.fulfill(card ? { json: { game: card } } : { status: 404, json: { error: "Unknown BGG game" } });
  });
  // Feedback on a photo never reaches the real photo log (recordPhotoFeedback replaces this to read it).
  await page.route("**/api/photo-logs/*/*", (route) => route.fulfill({ status: 204 }));
  return uploads;
}

/** A photo's answer as the server streams it: each game, then the result (one JSON object per line). */
export function coverStream(answer: CoverResult): string {
  const games = answer.status === "matched" ? answer.games : [];
  const events: CoverEvent[] = [
    ...games.map((game, i) => ({ type: "game" as const, game, more: i < games.length - 1, logId: LOG_ID })),
    { type: "done", result: answer },
  ];
  return events.map((event) => `${JSON.stringify(event)}\n`).join("");
}

/** The photo-log id every fake photo answer carries. */
export const LOG_ID = "00000000-0000-4000-8000-000000000001";

/** Records what the page reports to the photo log (`POST /api/photo-logs/:id/corrections|confirmations`). */
export async function recordPhotoFeedback(page: Page) {
  const feedback: { id: string; kind: string; body: unknown }[] = [];
  await page.route("**/api/photo-logs/*/*", async (route) => {
    const [id, kind] = new URL(route.request().url()).pathname.split("/").slice(-2);
    feedback.push({ id, kind, body: route.request().postDataJSON() });
    await route.fulfill({ status: 204 });
  });
  return feedback;
}

/** The answer for a photo showing these games, the first one being the main title. */
export function photoOf(...games: (GameCard | { game: GameCard; match: "auto" | "guess"; alternatives?: GameCard[] })[]): CoverResult {
  return {
    status: "matched",
    text: [],
    logId: LOG_ID,
    games: games.map((g) => ("game" in g ? { alternatives: [], ...g } : { game: g, match: "auto", alternatives: [] })),
  };
}

/**
 * Answers the next photo the way the server streams it, one line every `everyMs` (Playwright's routes send
 * a body all at once): the games arrive one by one. Call before the page loads.
 */
export async function streamCoverSlowly(page: Page, answer: CoverResult, everyMs: number) {
  const lines = coverStream(answer).split("\n").filter(Boolean);
  await page.addInitScript(
    ({ lines, everyMs }) => {
      const realFetch = window.fetch;
      window.fetch = (input, init) => {
        if (!String(input instanceof Request ? input.url : input).endsWith("/api/cover")) return realFetch(input, init);
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const line of lines) {
              await new Promise((resolve) => setTimeout(resolve, everyMs));
              controller.enqueue(encoder.encode(`${line}\n`));
            }
            controller.close();
          },
        });
        return Promise.resolve(new Response(body, { headers: { "Content-Type": "application/x-ndjson" } }));
      };
    },
    { lines, everyMs },
  );
}
