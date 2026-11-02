import type { Page } from "@playwright/test";

/**
 * Replaces getUserMedia with a 1280x720 canvas stream showing a fake box on a table, so the live camera,
 * the shutter and frame capture work in headless Chrome. `deny` simulates a blocked camera.
 */
export async function installFakeCamera(page: Page, { deny = false } = {}) {
  await page.addInitScript(
    ({ deny }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;
      const draw = () => {
        ctx.fillStyle = "#7d7d7d";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(440, 160, 400, 400);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 72px sans-serif";
        ctx.fillText("CATAN", 520, 380);
        requestAnimationFrame(draw);
      };
      draw();

      navigator.mediaDevices.getUserMedia = async () => {
        if (deny) throw new DOMException("Permission denied", "NotAllowedError");
        return canvas.captureStream(30);
      };
    },
    { deny },
  );
}
