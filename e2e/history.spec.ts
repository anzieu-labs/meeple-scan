import { expect, test, type Page } from "@playwright/test";

import { fakeApi, game, photoOf } from "./fake-api";
import { installFakeCamera } from "./fake-camera";

const catan = game({ bggId: 13, name: "Catan", ratingAverage: 7.09 });
const azul = game({ bggId: 230802, name: "Azul", ratingAverage: 8.2 });

test.beforeEach(async ({ page }) => {
  await fakeApi(page, photoOf(catan), photoOf(azul));
  await installFakeCamera(page);
  await page.goto("/");
  await expect(page.getByTestId("photo-frame")).toBeVisible();
});

/** Photographs the next box and marks the game found as right: only those go to the history. */
async function photograph(page: Page, name: string) {
  await page.getByRole("button", { name: "Photo of the box" }).click();
  await expect(page.getByTestId("game-peek").getByRole("heading", { name })).toBeVisible();
  await page.getByTestId("check-game").getByRole("button", { name: "Right game" }).click();
  await page.getByRole("button", { name: "Show less" }).click();
}

const historyRows = (page: Page) => page.getByTestId("history-list").getByRole("listitem");

test("keeps games, newest first, across reloads, and reopens them", async ({ page }) => {
  await photograph(page, "Catan");
  await photograph(page, "Azul");

  await page.reload();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("2 on this phone")).toBeVisible();
  await expect(historyRows(page)).toHaveText([/Azul.*now.*8\.2/, /Catan.*now.*7\.1/]);

  await historyRows(page).filter({ hasText: "Catan" }).getByRole("button", { name: /^Catan/ }).click();
  const drawer = page.getByTestId("game-drawer");
  await expect(drawer.getByRole("heading", { name: "Catan" })).toBeVisible();
  await expect(drawer.getByTestId("game-details")).toBeVisible();
});

test("a game nobody marked right stays out of the history", async ({ page }) => {
  await page.getByRole("button", { name: "Photo of the box" }).click();
  await expect(page.getByTestId("game-peek").getByRole("heading", { name: "Catan" })).toBeVisible();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Games you photograph appear here.")).toBeVisible();
});

test("removes one game or clears everything", async ({ page }) => {
  await photograph(page, "Catan");
  await photograph(page, "Azul");

  await page.getByRole("link", { name: "History" }).click();
  await page.getByRole("button", { name: "Remove Catan from history" }).click();
  await expect(historyRows(page)).toHaveText([/Azul/]);
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText("Games you photograph appear here.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Powered by BGG" }).first()).toHaveAttribute("href", "https://boardgamegeek.com");
});
