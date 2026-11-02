import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set PLAYWRIGHT_BASE_URL to test a deployment (e.g. a Vercel preview) instead of a local production build.
const remoteURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: remoteURL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Installed Google Chrome; the camera is faked in e2e/fake-camera.ts.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: remoteURL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
      },
});
