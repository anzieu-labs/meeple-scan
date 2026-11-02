import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The OCR evaluation calls BGG and needs run_ocr.py output, so it only runs on demand (OCR_EVAL=1).
    include: process.env.OCR_EVAL ? ["ocr-eval/**/*.test.ts"] : ["lib/**/*.test.ts"],
  },
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside React Server Components; server modules are plain Node code in tests.
    alias: { "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)) },
  },
});
