import { expect, test, type Page } from "@playwright/test";

import { LOG_ID, fakeApi, game, photoOf, recordPhotoFeedback, streamCoverSlowly } from "./fake-api";
import { installFakeCamera } from "./fake-camera";

const catan = game({
  bggId: 13,
  name: "Catan",
  yearPublished: 1995,
  ratingAverage: 7.09,
  usersRated: 145_099,
  weight: 2.28,
  bestPlayers: [4],
  recommendedPlayers: [3, 4],
  minPlayers: 3,
  maxPlayers: 4,
  mechanics: ["Dice Rolling", "Trading"],
});
const viticulture = game({ bggId: 183394, name: "Viticulture Essential Edition", ratingAverage: 8.0 });
const tuscany = game({ bggId: 199792, name: "Viticulture: Tuscany Essential Edition", type: "boardgameexpansion" });
const azul = game({ bggId: 230802, name: "Azul", ratingAverage: 7.7 });
const mars = game({ bggId: 167791, name: "Terraforming Mars", ratingAverage: 8.4 });

/** The camera starts by itself when the page opens: no button to tap. */
async function openCamera(page: Page) {
  await installFakeCamera(page);
  await page.goto("/");
  await expect(page.getByTestId("photo-frame")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start camera" })).toHaveCount(0);
}

const peek = (page: Page) => page.getByTestId("game-peek");
const takePhoto = (page: Page) => page.getByRole("button", { name: "Photo of the box" }).click();
const checkGame = (page: Page) => page.getByTestId("check-game");
const rightGame = (page: Page) => checkGame(page).getByRole("button", { name: "Right game" }).click();
const wrongGame = (page: Page) => checkGame(page).getByRole("button", { name: "Wrong game" }).click();

test("a photo asks if the game is right before showing it, then its Yuka-style details", async ({ page }) => {
  const uploads = await fakeApi(page, photoOf(catan));
  await openCamera(page);
  await takePhoto(page);

  await expect(peek(page).getByRole("heading", { name: "Catan" })).toBeVisible();
  expect(uploads).toHaveLength(1);
  expect(uploads[0].type).toBe("image/jpeg");
  expect(uploads[0].bytes).toBeGreaterThan(1000);

  // Nothing about the game until it's answered, even pulled up.
  await expect(peek(page).getByRole("img", { name: "Rating shown once you confirm the game" })).toBeVisible();
  await expect(peek(page).getByRole("img", { name: /out of 10/ })).toHaveCount(0);
  // Opened in full straight away, with the box art to compare.
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
  await expect(page.getByTestId("confirm-first")).toBeVisible();
  await expect(page.getByTestId("game-details")).toHaveCount(0);

  await rightGame(page);
  await expect(checkGame(page)).toHaveCount(0);
  await expect(peek(page).getByRole("img", { name: "Rating 7.1 out of 10, Good" })).toBeVisible();
  const details = page.getByTestId("game-details");
  await expect(details.getByText("Rated good on BGG")).toBeVisible();
  await expect(details.getByText("Medium-light complexity")).toBeVisible();
  await expect(details.getByText("Best with 4")).toBeVisible();
  await expect(details.getByText("Good with 3–4 · box says 3–4 players")).toBeVisible();
  await expect(details.getByText("Dice Rolling")).toBeVisible();
  await expect(details.getByText("Trading")).toBeVisible();
  await expect(details.getByRole("link", { name: "View on BoardGameGeek" })).toHaveAttribute(
    "href",
    "https://boardgamegeek.com/boardgame/13",
  );
  // Confirmed, the game stands alone: no search or way to change it under the details.
  await expect(page.getByRole("textbox", { name: "Game name" })).toHaveCount(0);
});

test("the stat chosen in Settings shows beside the game instead of its rating, there and in the lists", async ({ page }) => {
  await fakeApi(page, photoOf(catan));
  await page.goto("/settings");
  await page.getByTestId("scan-stat").getByRole("radio", { name: "Complexity" }).click();
  await expect(page.getByRole("radio", { name: "Complexity" })).toHaveAttribute("aria-checked", "true");

  await installFakeCamera(page);
  await page.goto("/");
  await takePhoto(page);
  await rightGame(page);
  await expect(peek(page).getByRole("img", { name: "Medium-light complexity, 2.3/5" })).toBeVisible();
  await expect(peek(page)).not.toContainText("7.1");

  // And in every list: the history keeps it too.
  await page.goto("/history");
  const row = page.getByRole("button", { name: /^Catan/ });
  await expect(row).toContainText("Medium-light complexity, 2.3/5");
  await expect(row).not.toContainText("7.1");
});

test("only the framed part of the camera is sent, and the whole screen shows it being read", async ({ page }) => {
  const uploads = await fakeApi(page, photoOf(catan));
  let answer = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  // Holds the answer until the loading screen has been checked (the newest route runs first).
  await page.route("**/api/cover", async (route) => {
    await answered;
    await route.fallback();
  });
  await openCamera(page);
  const frame = await page.getByTestId("photo-frame").boundingBox();
  await takePhoto(page);

  const reading = page.getByTestId("reading-photo");
  await expect(reading).toBeVisible();
  await expect(reading).toContainText("Reading the box…");
  await expect(reading).toHaveCSS("position", "fixed");
  expect(await reading.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize() });
  // On top of everything, the sheet included.
  const onTop = await page.evaluate(() =>
    document.elementFromPoint(innerWidth / 2, innerHeight - 40)?.closest("[data-testid=reading-photo]"),
  );
  expect(onTop).toBeTruthy();
  answer();

  await expect(peek(page).getByRole("heading", { name: "Catan" })).toBeVisible();
  await expect(reading).toBeHidden();
  // The upload has the frame's proportions, not the camera's 16:9.
  const [width, height] = await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    return [bitmap.width, bitmap.height];
  }, uploads[0].body!.toString("base64"));
  expect(width / height).toBeCloseTo(frame!.width / frame!.height, 1);
});

test("a best guess can be corrected with 'Wrong game', and the pick is sent to the photo log", async ({ page }) => {
  await fakeApi(page, photoOf({ game: viticulture, match: "guess", alternatives: [tuscany] }));
  const feedback = await recordPhotoFeedback(page);
  await openCamera(page);
  await takePhoto(page);
  await expect(peek(page).getByRole("heading", { name: "Viticulture Essential Edition" })).toBeVisible();
  await expect(peek(page).getByText("Best guess")).toBeVisible();

  // Right on the peek, without pulling the sheet up.
  await wrongGame(page);
  await expect(page.getByText("Which game is this box?")).toBeVisible();
  await page.getByRole("button", { name: /Tuscany/ }).click();
  await expect(peek(page).getByRole("heading", { name: /Tuscany/ })).toBeVisible();
  await expect(peek(page).getByText("Best guess")).toHaveCount(0);
  // The game picked is the user's own: its details show straight away.
  await expect(page.getByTestId("game-details")).toBeVisible();
  await expect
    .poll(() => feedback)
    .toEqual([{ id: LOG_ID, kind: "corrections", body: { from: 183394, to: 199792, via: "alternative" } }]);
});

test("'Back' from the correction returns to the question", async ({ page }) => {
  await fakeApi(page, photoOf({ game: viticulture, match: "guess", alternatives: [tuscany] }));
  await openCamera(page);
  await takePhoto(page);
  await wrongGame(page);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(checkGame(page)).toBeVisible();
  await expect(page.getByTestId("game-details")).toHaveCount(0);
});

test("a new photo replaces the previous game", async ({ page }) => {
  await fakeApi(page, photoOf(catan), photoOf(azul));
  await openCamera(page);
  await takePhoto(page);
  await expect(peek(page).getByRole("heading", { name: "Catan" })).toBeVisible();
  // The game opens in full, over the shutter: lowered, the camera is back.
  await page.getByRole("button", { name: "Show less" }).click();
  await takePhoto(page);
  await expect(peek(page).getByRole("heading", { name: "Azul" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
});

test("several boxes on one photo open on a summary, each marked right or wrong from its row", async ({ page }) => {
  await fakeApi(page, photoOf(catan, mars, { game: azul, match: "guess", alternatives: [viticulture] }, tuscany));
  const feedback = await recordPhotoFeedback(page);
  await openCamera(page);
  await takePhoto(page);

  // Pulled up straight away, biggest title first; nothing about a game shows before it's marked right.
  const summary = page.getByTestId("photo-summary");
  await expect(page.getByTestId("summary-peek")).toContainText("4 games on this photo");
  const rows = summary.getByTestId("summary-game");
  await expect(rows).toHaveText([/Catan/, /Terraforming Mars/, /Azul.*Best guess/, /Tuscany/]);
  await expect(summary.getByText("7.1")).toHaveCount(0);
  await expect(page.getByText("2 of 4")).toHaveCount(0);

  // Right from the row: the score shows in its place.
  await page.getByRole("button", { name: "Right game: Catan" }).click();
  await expect(rows.nth(0)).toContainText("7.1");
  await expect(page.getByRole("button", { name: "Right game: Catan" })).toHaveCount(0);

  // Wrong from the row: the correction opens, and the summary comes back with the game picked.
  await page.getByRole("button", { name: "Wrong game: Azul" }).click();
  await expect(page.getByText("Which game is this box?")).toBeVisible();
  await page.getByRole("button", { name: /Viticulture/ }).click();
  await expect(rows).toHaveText([/Catan/, /Terraforming Mars/, /Viticulture Essential/, /Tuscany/]);

  // The rest in one go.
  await summary.getByRole("button", { name: "They're all right" }).click();
  await expect(rows.nth(1)).toContainText("8.4");
  await expect(summary.getByRole("button", { name: "They're all right" })).toHaveCount(0);
  await expect.poll(() => feedback.length).toBe(4);
  expect(feedback.slice(0, 2)).toEqual([
    { id: LOG_ID, kind: "confirmations", body: { bggId: 13 } },
    { id: LOG_ID, kind: "corrections", body: { from: 230802, to: 183394, via: "alternative" } },
  ]);
  expect(feedback.slice(2)).toEqual(
    expect.arrayContaining([
      { id: LOG_ID, kind: "confirmations", body: { bggId: 167791 } },
      { id: LOG_ID, kind: "confirmations", body: { bggId: 199792 } },
    ]),
  );

  // All four are in the history.
  await page.getByRole("button", { name: "Show less" }).click();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByTestId("history-list").getByRole("listitem")).toHaveCount(4);
});

test("games appear one by one as they're found, with a placeholder for the next", async ({ page }) => {
  await fakeApi(page, photoOf(catan));
  await streamCoverSlowly(page, photoOf(catan, mars, azul), 700);
  await openCamera(page);
  await takePhoto(page);

  // The first game shows (summary, pulled up) while the others are still on their way.
  const rows = page.getByTestId("summary-game");
  await expect(rows).toHaveText([/Catan/]);
  await expect(page.getByTestId("summary-loading")).toBeVisible();
  await expect(page.getByTestId("summary-peek")).toContainText("Looking for more games");
  await expect(page.getByTestId("reading-photo")).toBeHidden();
  // Answering doesn't wait for the rest.
  await page.getByRole("button", { name: "Right game: Catan" }).click();
  await expect(rows).toHaveText([/Catan.*7\.1/, /Terraforming Mars/]);
  await expect(rows).toHaveText([/Catan/, /Terraforming Mars/, /Azul/]);
  await expect(page.getByTestId("summary-loading")).toHaveCount(0);
  await expect(page.getByTestId("summary-peek")).toContainText("Tell us which ones are right");
});

test("tapping a game in the summary shows it, and 'All games' on the open sheet goes back", async ({ page }) => {
  await fakeApi(page, photoOf(catan, mars, azul));
  await openCamera(page);
  await takePhoto(page);
  await page.getByTestId("summary-game").filter({ hasText: "Terraforming Mars" }).getByRole("button").first().click();
  await expect(peekTitle(page)).toHaveText(["Terraforming Mars"]);
  // Not marked right yet: the question, not the details.
  await expect(checkGame(page)).toBeVisible();
  await rightGame(page);
  await expect(page.getByTestId("game-details")).toBeVisible();
  // Only on the open sheet: the peek has no room for it.
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(page.getByRole("button", { name: "All games" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("button", { name: "All games" }).click();
  await expect(page.getByTestId("summary-game").nth(1)).toContainText("8.4");
});

test("resting at the peek, a tap anywhere on the sheet opens it in full, never the hidden details", async ({ page }) => {
  await fakeApi(page, photoOf(catan));
  await openCamera(page);
  await takePhoto(page);
  await rightGame(page);
  await page.getByRole("button", { name: "Show less" }).click();
  await sheetSettled(page);

  // Just under the game's title: the strip where the hidden details start.
  const head = (await page.getByRole("button", { name: "Show details" }).boundingBox())!;
  await page.mouse.click(head.x + head.width - 30, head.y + head.height + 8);
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
});

test("resting at the peek, a finger's tap opens the sheet, even on the question's strip", async ({ page }) => {
  await fakeApi(page, photoOf(catan));
  await openCamera(page);
  await takePhoto(page);
  // Not answered yet: the peek keeps "Wrong game" and "Right game".
  await page.getByRole("button", { name: "Show less" }).click();
  await sheetSettled(page);

  // Beside the buttons, not on them: the drawer reports a snap point on a plain tap, which must not read as a drag.
  const strip = (await checkGame(page).boundingBox())!;
  await page.touchscreen.tap(strip.x + strip.width / 2, strip.y + strip.height - 3);
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
});

/** Opens one game of a photo of several from its summary, as a finger would. */
async function openFromSummary(page: Page, name: string) {
  await page.getByTestId("summary-game").filter({ hasText: name }).getByRole("button").first().click();
  await expect(peekTitle(page)).toHaveText([name]);
}

/** The game in the peek, once the previous one has slid out. */
const peekTitle = (page: Page) => peek(page).getByRole("heading");

/** Waits until the sheet and its content stop moving (pulled up, or a game sliding in), as a finger would. */
async function sheetSettled(page: Page) {
  const sheet = page.getByTestId("sheet-content");
  await expect
    .poll(async () => {
      const a = await sheet.boundingBox();
      await page.waitForTimeout(80);
      const b = await sheet.boundingBox();
      return a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 1 && Math.abs(b.x) < 1;
    })
    .toBe(true);
}

/** A sideways swipe across the pulled-up sheet. */
async function swipe(page: Page, direction: "left" | "right") {
  await sheetSettled(page);
  const box = (await page.getByTestId("sheet-body").boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 200);
  const [from, to] = direction === "left" ? [box.x + box.width - 40, box.x + 40] : [box.x + 40, box.x + box.width - 40];
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move((from + to) / 2, y + 4, { steps: 4 });
  await page.mouse.move(to, y + 6, { steps: 4 });
  await page.mouse.up();
}

test("pulled up, swiping goes through the other games on the same photo", async ({ page }) => {
  await fakeApi(page, photoOf(catan, mars, azul), photoOf(catan));
  await openCamera(page);
  await takePhoto(page);
  await openFromSummary(page, "Catan");

  // Dots only: "1 of 3 on this photo" is for screen readers.
  const pager = page.getByTestId("photo-pager");
  await expect(pager).toContainText("1 of 3 on this photo");
  await expect(page.getByText("on this photo · swipe")).toHaveCount(0);
  // Everything inside the sheet follows the finger, not just its text; the sheet and the dots stay.
  await sheetSettled(page);
  const sheet = page.locator("[data-slot=drawer-popup]");
  const content = page.getByTestId("sheet-content");
  const body = (await page.getByTestId("sheet-body").boundingBox())!;
  const sheetStart = (await sheet.boundingBox())!;
  const pagerStart = (await pager.boundingBox())!;
  const startX = (await content.boundingBox())!.x;
  await page.mouse.move(body.x + body.width - 40, body.y + 150);
  await page.mouse.down();
  await page.mouse.move(body.x + body.width - 200, body.y + 154, { steps: 6 });
  expect((await content.boundingBox())!.x).toBeLessThan(startX - 100);
  expect(await sheet.boundingBox()).toEqual(sheetStart);
  expect(await pager.boundingBox()).toEqual(pagerStart);
  // The dots sit above the game, at the top of the sheet.
  expect(pagerStart.y + pagerStart.height).toBeLessThanOrEqual((await peek(page).boundingBox())!.y);
  await page.mouse.up();
  await expect(peekTitle(page)).toHaveText(["Terraforming Mars"]);
  await expect(pager).toContainText("2 of 3");
  await swipe(page, "right");
  await expect(peekTitle(page)).toHaveText(["Catan"]);
  // It loops: before the first game comes the last one.
  await swipe(page, "right");
  await expect(peekTitle(page)).toHaveText(["Azul"]);
  await expect(pager).toContainText("3 of 3");
  await swipe(page, "left");
  await expect(peekTitle(page)).toHaveText(["Catan"]);

  // Only the full sheet pages; a photo with one game has nothing to swipe to.
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(pager).toHaveCount(0);
  await takePhoto(page);
  await expect(page.getByTestId("photo-summary")).toHaveCount(0);
  await rightGame(page);
  await expect(page.getByTestId("game-details")).toBeVisible();
  await expect(pager).toHaveCount(0);
});

/**
 * A finger dragged across the screen through `points`, with real touch events (the drawer drags only by
 * touch or by its handle, never by a mouse on its content). `during` runs before the finger lifts.
 */
async function touchDrag(page: Page, points: { x: number; y: number }[], during?: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", point?: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [point] : [] });
  await touch("touchStart", points[0]);
  for (const point of points.slice(1)) {
    await touch("touchMove", point);
    await page.waitForTimeout(16);
  }
  await during?.();
  await touch("touchEnd");
  await cdp.detach();
}

/** `steps` points from `from` to `to`, evenly spaced. */
function line(from: { x: number; y: number }, to: { x: number; y: number }, steps: number) {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  }));
}

test("a swipe moves along one axis only: the content sideways to page, the sheet down to resize", async ({ page }) => {
  await fakeApi(page, photoOf(catan, mars, azul));
  await openCamera(page);
  await takePhoto(page);
  await openFromSummary(page, "Catan");
  await expect(page.getByTestId("photo-pager")).toContainText("1 of 3");
  await sheetSettled(page);
  const sheet = page.locator("[data-slot=drawer-popup]");
  const content = page.getByTestId("sheet-content");
  const start = (await sheet.boundingBox())!;
  const contentStart = (await content.boundingBox())!;
  const body = (await page.getByTestId("sheet-body").boundingBox())!;

  // Sideways with the finger drifting down, as thumbs do: the content follows sideways at its height, and
  // the sheet doesn't move at all.
  const right = body.x + body.width - 40;
  const y = body.y + 150;
  await touchDrag(page, line({ x: right, y }, { x: right - 200, y: y + 60 }, 10), async () => {
    const moved = (await content.boundingBox())!;
    expect(moved.x).toBeLessThan(contentStart.x - 100);
    expect(moved.y).toBe(contentStart.y);
    expect(await sheet.boundingBox()).toEqual(start);
  });
  await expect(peekTitle(page)).toHaveText(["Terraforming Mars"]);
  await sheetSettled(page);
  expect(await sheet.boundingBox()).toEqual(start);

  // Down with the finger drifting sideways: the sheet follows down, and neither it nor its content sideways.
  const x = body.x + body.width / 2;
  await touchDrag(page, line({ x, y: body.y + 40 }, { x: x - 50, y: body.y + 240 }, 10), async () => {
    const moved = (await sheet.boundingBox())!;
    expect(moved.y).toBeGreaterThan(start.y + 100);
    expect(moved.x).toBe(start.x);
    expect((await content.boundingBox())!.x).toBe(contentStart.x);
  });
  await expect(peekTitle(page)).toHaveText(["Terraforming Mars"]);
});

test("'Right game' opens the details and marks the photo's game as right in the photo log", async ({ page }) => {
  await fakeApi(page, photoOf(catan));
  const feedback = await recordPhotoFeedback(page);
  await openCamera(page);
  await takePhoto(page);
  await rightGame(page);
  await expect(page.getByTestId("game-details")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
  await expect.poll(() => feedback).toEqual([{ id: LOG_ID, kind: "confirmations", body: { bggId: 13 } }]);
});

test("'Wrong game' on a sure match opens a search, and the game found is logged as the correction", async ({
  page,
}) => {
  await fakeApi(page, photoOf(catan));
  const feedback = await recordPhotoFeedback(page);
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { games: [azul] } }));
  await openCamera(page);
  await takePhoto(page);
  await wrongGame(page);

  // No alternatives for a sure match: straight to the search, starting from the name that was read.
  await expect(page.getByText("Which game is this box?")).toBeVisible();
  const search = page.getByRole("textbox", { name: "Game name" }).first();
  await expect(search).toHaveValue("Catan");
  await search.fill("azul");
  await page.getByRole("button", { name: "Search", exact: true }).first().click();
  await page.getByRole("button", { name: /Azul/ }).click();
  await expect(peekTitle(page)).toHaveText(["Azul"]);
  await expect
    .poll(() => feedback)
    .toEqual([{ id: LOG_ID, kind: "corrections", body: { from: 13, to: 230802, via: "search" } }]);
  // The game picked is the user's own: nothing left to check.
  await expect(checkGame(page)).toHaveCount(0);
  await expect(page.getByTestId("game-details")).toBeVisible();
});

test("a quick second swipe works while the next sheet is still sliding in", async ({ page }) => {
  await fakeApi(page, photoOf(catan, mars, azul));
  await openCamera(page);
  await takePhoto(page);
  await openFromSummary(page, "Catan");
  await sheetSettled(page);
  // Fixed screen positions, like a finger: the sheet itself is moving.
  const { width, height } = page.viewportSize()!;
  const flick = async () => {
    await page.mouse.move(width - 40, height * 0.6);
    await page.mouse.down();
    await page.mouse.move(40, height * 0.6 + 2, { steps: 5 });
    await page.mouse.up();
  };
  await flick();
  await page.waitForTimeout(300);
  await flick();
  await expect(peekTitle(page)).toHaveText(["Azul"]);
});

test("an unrecognised box offers another photo and name search", async ({ page }) => {
  await fakeApi(page, { status: "not_found", text: ["mystery game"], logId: LOG_ID });
  await openCamera(page);
  await takePhoto(page);
  await expect(page.getByText("Box not recognised")).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByText("Read on the box: mystery game")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take another photo" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Game name" })).toBeVisible();
});

test("an unrecognised box then found by name search is sent to the photo log", async ({ page }) => {
  await fakeApi(page, { status: "not_found", text: ["mystery game"], logId: LOG_ID });
  const feedback = await recordPhotoFeedback(page);
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { games: [azul] } }));
  await openCamera(page);
  await takePhoto(page);
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("textbox", { name: "Game name" }).fill("azul");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Azul/ }).click();
  await expect(peekTitle(page)).toHaveText(["Azul"]);
  await expect
    .poll(() => feedback)
    .toEqual([{ id: LOG_ID, kind: "corrections", body: { from: null, to: 230802, via: "search" } }]);
});

test("explains when the box reader is down and keeps search available", async ({ page }) => {
  await fakeApi(page, { status: "unavailable", service: "ocr" });
  await openCamera(page);
  await takePhoto(page);
  await expect(page.getByText("Box reader unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByRole("textbox", { name: "Game name" })).toBeVisible();
});

test("says when BoardGameGeek is busy rather than blaming the box reader", async ({ page }) => {
  await fakeApi(page, { status: "unavailable", service: "bgg" });
  await openCamera(page);
  await takePhoto(page);
  await expect(page.getByText("BoardGameGeek is busy")).toBeVisible();
  await expect(page.getByText("Box reader unavailable")).toHaveCount(0);
});

test("with the camera blocked, it says why and offers a gallery photo, the camera again or the search tab", async ({ page }) => {
  await installFakeCamera(page, { deny: true });
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Camera access was blocked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a photo from your gallery" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Photo of the box" })).toHaveCount(0);

  // No empty sheet before a photo: search is a tab of its own.
  await expect(page.getByTestId("sheet-content")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
});

test("with the camera blocked, a photo from the gallery is shrunk and read like a camera photo", async ({ page }) => {
  const uploads = await fakeApi(page, photoOf(catan));
  await installFakeCamera(page, { deny: true });
  await page.goto("/");

  // A big gallery photo (3000 px), drawn in the page so the test needs no image file.
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 2000;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(0, 0, 3000, 2000);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose a photo from your gallery" }).click();
  await (await chooser).setFiles({ name: "shelf.png", mimeType: "image/png", buffer: Buffer.from(photo) });

  await expect(peek(page).getByRole("heading", { name: "Catan" })).toBeVisible();
  expect(uploads).toHaveLength(1);
  expect(uploads[0].type).toBe("image/jpeg");
});
