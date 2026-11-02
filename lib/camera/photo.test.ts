import { describe, expect, it } from "vitest";

import { coverRegion } from "./photo";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("coverRegion", () => {
  it("maps a frame on a portrait screen to the middle of a landscape video", () => {
    // 1280x720 video on a 360x800 screen: scaled by 800/720, 1422px wide, 531px cropped off each side.
    const region = coverRegion(rect(0, 0, 360, 800), 1280, 720, rect(20, 80, 320, 400));
    const scale = 800 / 720;
    expect(region.x).toBeCloseTo((20 + (1280 * scale - 360) / 2) / scale);
    expect(region.y).toBeCloseTo(72);
    expect(region.width).toBeCloseTo(288);
    expect(region.height).toBeCloseTo(360);
  });

  it("is the whole video when the frame covers the element exactly and the ratios match", () => {
    expect(coverRegion(rect(0, 0, 360, 640), 720, 1280, rect(0, 0, 360, 640))).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 1280,
    });
  });

  it("clamps a frame reaching past the video", () => {
    const region = coverRegion(rect(0, 0, 360, 640), 720, 1280, rect(-10, -10, 400, 700));
    expect(region).toEqual({ x: 0, y: 0, width: 720, height: 1280 });
  });
});
