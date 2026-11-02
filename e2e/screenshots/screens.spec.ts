import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import type { GameCard } from "@/lib/game/types";
import { LOCALES, localePath } from "@/lib/i18n/config";

import { fakeApi, photoOf } from "../fake-api";
import { installFakeCamera } from "../fake-camera";

/**
 * The phone screens shown on the desktop landing (public/screens/<locale>/), with real games from the
 * database: a shelf's summary, one game's details, and the rankings. Only the photo is faked.
 */
const SHELF = [266192, 230802, 9209, 13, 162886, 173346]; // Wingspan, Azul, Ticket to Ride, Catan, Spirit Island, 7 Wonders Duel
const DETAILS = 266192;

const out = (locale: string, name: string) => `public/screens/${locale}/${name}.jpg`;

async function card(request: APIRequestContext, bggId: number): Promise<GameCard> {
  const res = await request.get(`/api/games/${bggId}`);
  expect(res.ok()).toBe(true);
  return (await res.json()).game;
}

/**
 * A camera filming a shelf: the real box art of `covers` (through the app's own image optimizer, so the
 * canvas isn't cross-origin), two rows standing on wooden shelves, in portrait like a phone's camera.
 */
async function installShelfCamera(page: Page, covers: string[]) {
  const urls = covers.map((url) => `/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`);
  await page.addInitScript((urls: string[]) => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    // The phone screen's shape, so the picture isn't cropped at the sides.
    canvas.height = Math.round((720 * innerHeight) / innerWidth);
    const ctx = canvas.getContext("2d")!;
    const images = urls.map((src) => Object.assign(new Image(), { src }));
    const wood = (y: number) => {
      const plank = ctx.createLinearGradient(0, y, 0, y + 34);
      plank.addColorStop(0, "#8a5a33");
      plank.addColorStop(1, "#5b3a20");
      ctx.fillStyle = plank;
      ctx.fillRect(0, y, canvas.width, 34);
    };
    const draw = () => {
      const wall = ctx.createLinearGradient(0, 0, 0, canvas.height);
      wall.addColorStop(0, "#3b2a1f");
      wall.addColorStop(1, "#24180f");
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Three boxes per row, each standing on its shelf with a soft shadow.
      const rows = [canvas.height * 0.39, canvas.height * 0.66].map(Math.round);
      images.forEach((img, i) => {
        if (!img.complete || !img.naturalWidth) return;
        const row = Math.floor(i / 3);
        if (row >= rows.length) return;
        const w = 190;
        const h = Math.min(250, (w * img.naturalHeight) / img.naturalWidth);
        const x = 45 + (i % 3) * 215;
        const y = rows[row] - h;
        ctx.shadowColor = "rgb(0 0 0 / 0.55)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(img, x, y, w, h);
        ctx.shadowColor = "transparent";
      });
      rows.forEach(wood);
      (window as unknown as { shelfReady?: boolean }).shelfReady = images.every((img) => img.complete);
      requestAnimationFrame(draw);
    };
    draw();
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(30);
  }, urls);
}

/** Waits for the images on screen (lazy ones further down never load), then for the sheet to settle. */
async function still(page: Page) {
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => {
        const box = img.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < innerHeight;
      })
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.waitForTimeout(900);
}

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test.use({ locale });

    test("shelf", async ({ page, request }) => {
      await fakeApi(page, photoOf(...(await Promise.all(SHELF.map((id) => card(request, id))))));
      await installFakeCamera(page);
      await page.goto(localePath(locale, "/"));
      await expect(page.getByTestId("photo-frame")).toBeVisible();
      await page.locator("button[aria-label]").filter({ has: page.locator("span.rounded-full.bg-white") }).click();
      await expect(page.getByTestId("summary-game")).toHaveCount(SHELF.length);
      await still(page);
      await page.screenshot({ path: out(locale, "shelf"), type: "jpeg", quality: 82 });
    });

    test("details", async ({ page, request }) => {
      await fakeApi(page, photoOf(await card(request, DETAILS)));
      await installFakeCamera(page);
      await page.goto(localePath(locale, "/"));
      await expect(page.getByTestId("photo-frame")).toBeVisible();
      await page.locator("button[aria-label]").filter({ has: page.locator("span.rounded-full.bg-white") }).click();
      await page.getByTestId("check-game").getByRole("button").last().click();
      await expect(page.getByTestId("game-details")).toBeVisible();
      await still(page);
      await page.screenshot({ path: out(locale, "details"), type: "jpeg", quality: 82 });
    });

    test("scan", async ({ page, request }) => {
      const covers = await Promise.all(SHELF.map(async (id) => (await card(request, id)).image));
      await installShelfCamera(page, covers.filter((url): url is string => Boolean(url)));
      await page.goto(localePath(locale, "/"));
      await expect(page.getByTestId("photo-frame")).toBeVisible();
      await page.waitForFunction(() => (window as unknown as { shelfReady?: boolean }).shelfReady === true);
      await page.waitForTimeout(900);
      await page.screenshot({ path: out(locale, "scan"), type: "jpeg", quality: 82 });
    });
  });
}
