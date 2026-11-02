import { expect, test } from "@playwright/test";

import { game } from "./fake-api";
import { installFakeCamera } from "./fake-camera";

const wingspan = game({ bggId: 266192, name: "Wingspan", yearPublished: 2019, ratingAverage: 8.0, usersRated: 120_000 });
const wingspanAsia = game({ bggId: 366161, name: "Wingspan Asia", ratingAverage: 7.9 });

test.beforeEach(async ({ page }) => {
  await installFakeCamera(page);
});

test("the tab bar goes everywhere, with Scan bigger and the current tab marked", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByTestId("tab-bar").getByRole("link");
  await expect(tabs).toHaveText(["History", "Rankings", "Scan", "Search", "Settings"]);
  await expect(page.getByRole("link", { name: "Scan" })).toHaveAttribute("aria-current", "page");
  const scan = (await page.getByRole("link", { name: "Scan" }).boundingBox())!;
  const history = (await page.getByRole("link", { name: "History" }).boundingBox())!;
  expect(scan.width).toBeGreaterThan(history.width);

  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Search", level: 1 })).toBeVisible();
});

test("search finds games as you type and opens one in a sheet, added to the history", async ({ page }) => {
  const queries: string[] = [];
  await page.route("**/api/search?*", (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q")!);
    return route.fulfill({ json: { games: [wingspan, wingspanAsia] } });
  });
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Game name" }).pressSequentially("wingspam", { delay: 30 });
  const results = page.getByTestId("search-results").getByRole("listitem");
  await expect(results).toHaveText([/Wingspan.*2019.*8\.0/, /Wingspan Asia/]);
  // One search once typing pauses, not one per letter.
  expect(queries).toEqual(["wingspam"]);

  await results.first().getByRole("button").click();
  await expect(page.getByTestId("game-drawer").getByRole("heading", { name: "Wingspan" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByTestId("history-list").getByRole("listitem")).toHaveText([/Wingspan/]);
});

test("the scan screen has no sheet until a photo is taken", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("photo-frame")).toBeVisible();
  await expect(page.getByText("Photograph a board game", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("sheet-content")).toHaveCount(0);
});

test("Settings sends feedback, with an email only if given, and links to the code", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/feedback", (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("link", { name: /Source code on GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/anzieu-labs/meeple-scan",
  );
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  // The BGG logo alone, no credit line.
  await expect(page.getByRole("img", { name: "Powered by BGG" })).toBeVisible();
  await expect(page.getByText("Ratings and game data from BoardGameGeek")).toHaveCount(0);

  const form = page.getByTestId("feedback-form");
  await expect(form.getByRole("button", { name: "Send" })).toBeDisabled();
  await form.getByRole("textbox", { name: "Your message" }).fill("Azul wasn't found from a photo of my shelf");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("feedback-sent")).toContainText("Thanks!");
  expect(sent).toEqual([{ message: "Azul wasn't found from a photo of my shelf", email: "", locale: "en" }]);
});

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test("the home page is the landing, and the camera is never asked for", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { cameraAsked: number };
      w.cameraAsked = 0;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          w.cameraAsked++;
          throw new Error("no camera in this test");
        };
      }
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scan it before you play it.");
    await expect(page.getByText("Open it on your phone")).toBeVisible();
    await expect(page.locator("main svg path").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rules clarifications" })).toBeVisible();
    await expect(page.getByTestId("photo-frame")).toHaveCount(0);
    await expect(page.getByTestId("tab-bar")).toBeHidden();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { cameraAsked: number }).cameraAsked)).toBe(0);
    // The phone is the way in: no links to the app's pages, only the QR code.
    await expect(page.getByRole("main").getByRole("link", { name: /rankings|search|what's hot/i })).toHaveCount(0);
  });

  test("the privacy page has the landing's header and footer, and its language picker stays on it", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
    await expect(page.getByText("run by Anzieu Labs Inc.")).toBeVisible();
    await expect(page.getByTestId("tab-bar")).toBeHidden();
    await expect(page.getByRole("contentinfo").getByRole("img", { name: "Powered by BGG" })).toBeVisible();
    await page.getByRole("button", { name: "Language: English" }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confidentialité");
  });
});
