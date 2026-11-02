import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

/** `pnpm screenshots`: the app's screens for the desktop landing, in every language (e2e/screenshots). */
export default defineConfig({
  ...base,
  testDir: "./e2e/screenshots",
  testIgnore: [],
  fullyParallel: true,
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], channel: "chrome", deviceScaleFactor: 2 } }],
});
