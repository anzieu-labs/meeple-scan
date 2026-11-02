import { expect, test } from "@playwright/test";

import { fakeApi, game, photoOf } from "./fake-api";
import { installFakeCamera } from "./fake-camera";

const catan = game({ bggId: 13, name: "Catan", yearPublished: 1995, ratingAverage: 7.09, usersRated: 145_099 });

test.describe("a French phone", () => {
  test.use({ locale: "fr-FR" });

  test("opens in French at /fr, and a photo's game is asked about in French", async ({ page }) => {
    await fakeApi(page, photoOf(catan));
    await installFakeCamera(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByTestId("tab-bar").getByRole("link")).toHaveText(["Historique", "Classements", "Scan", "Recherche", "Réglages"]);
    // Tabs stay in French.
    await expect(page.getByRole("link", { name: "Classements" })).toHaveAttribute("href", "/fr/rankings");

    await page.getByRole("button", { name: "Photo de la boîte" }).click();
    await page.getByTestId("check-game").getByRole("button", { name: "Bon jeu" }).click();
    // French numbers: a decimal comma.
    await expect(page.getByTestId("game-peek").getByRole("img", { name: "Note 7,1 sur 10, Bon" })).toBeVisible();
    await expect(page.getByTestId("game-details")).toContainText("Jugé bon sur BGG");
  });

  test("Settings switches to English and keeps it on the next visit", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/fr\/settings$/);
    await expect(page.getByRole("heading", { name: "Réglages", level: 1 })).toBeVisible();
    await page.getByRole("combobox", { name: "Langue" }).selectOption("en");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    // The choice beats the browser's French from now on.
    await page.goto("/rankings");
    await expect(page).toHaveURL(/\/rankings$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test("an English phone stays at the addresses without a prefix, and /fr is French for anyone", async ({ page }) => {
  await page.goto("/search");
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/fr/search");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("searchbox", { name: "Nom du jeu" })).toBeVisible();
});

test.describe("a German phone", () => {
  test.use({ locale: "de-DE" });

  test("opens in German at /de, with Settings listing every language in its own words", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/de\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    const select = page.getByRole("combobox", { name: "Sprache" });
    await expect(select).toHaveValue("de");
    await expect(select.locator("option")).toHaveText([
      "English",
      "Deutsch",
      "Français",
      "Español",
      "Português (Brasil)",
      "Italiano",
      "Polski",
      "日本語",
      "简体中文",
      "한국어",
    ]);
    await select.selectOption("ja");
    await expect(page).toHaveURL(/\/ja\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });
});
