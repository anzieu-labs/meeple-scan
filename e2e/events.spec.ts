import { expect, test, type Page } from "@playwright/test";

import { fakeApi, game, photoOf } from "./fake-api";
import { installFakeCamera } from "./fake-camera";

type Sent = { name: string; props: Record<string, unknown>; visit: string; locale: string };

/** Lets the page count events as a visitor's browser would (an automated one never does), and records them. */
async function recordEvents(page: Page) {
  const sent: Sent[] = [];
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  await page.route("**/api/events", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 204 });
  });
  return sent;
}

test("a visit from the landing's QR code is counted with its source, and so is a gallery photo", async ({ page }) => {
  const sent = await recordEvents(page);
  await fakeApi(page, photoOf(game({ bggId: 13, name: "Catan" })));
  await installFakeCamera(page, { deny: true });
  await page.goto("/?ref=qr");

  await expect.poll(() => sent.map((e) => e.name)).toContain("visit");
  const visit = sent.find((e) => e.name === "visit")!;
  expect(visit.props).toMatchObject({ path: "/", ref: "qr", device: "phone", installed: false });
  expect(visit.locale).toBe("en");

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose a photo from your gallery" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await (await chooser).setFiles({ name: "box.png", mimeType: "image/png", buffer: png });

  await expect.poll(() => sent.filter((e) => e.name === "photo").map((e) => e.props)).toEqual([{ source: "gallery" }]);
  // One page load, one visit id for all its events.
  expect(new Set(sent.map((e) => e.visit)).size).toBe(1);
});

test("an automated browser counts nothing", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/events", async (route) => {
    sent.push(route.request().postData());
    await route.fulfill({ status: 204 });
  });
  await installFakeCamera(page, { deny: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(sent).toEqual([]);
});
