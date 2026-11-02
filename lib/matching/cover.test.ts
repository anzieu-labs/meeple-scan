import { describe, expect, it } from "vitest";

import { coverMatchInput, extraTitleInputs, type OcrLine } from "./cover";

/** [text, score, box height, top y, x0, x1] → OcrLine (real PaddleOCR PP-OCRv6 output on BGG covers). */
const lines = (...rows: [string, number, number, number, number?, number?][]): OcrLine[] =>
  rows.map(([text, score, h, y, x0 = 100, x1 = 900]) => ({ text, score, box: [x0, y, x1, y + h] }));

describe("coverMatchInput", () => {
  it("takes the biggest text as the title", () => {
    const input = coverMatchInput(lines(["THE GAME", 0.98, 48, 520], ["CATAN", 1, 305, 180], ["KLAUSTEUBER", 0.998, 35, 1100]));
    expect(input.queries[0]).toBe("catan");
  });

  it("joins a title printed over two lines, top line first", () => {
    const input = coverMatchInput(lines(["MARS", 0.999, 175, 400], ["TERRAFORMING", 1, 108, 280], ["JACOBFRYXELIUS", 1, 44, 1100]));
    expect(input.queries[0]).toBe("terraforming mars");
    expect(input.queries).toContain("mars");
  });

  it("joins a much smaller subtitle right under the title", () => {
    const input = coverMatchInput(lines(["BＲASS", 0.76, 132, 200], ["BIRMINGHAM", 0.994, 40, 340], ["ROXLEY", 1, 21, 1200]));
    expect(input.queries[0]).toBe("brass birmingham");
  });

  it("ignores unreadable lines, ages, player counts and play times", () => {
    const input = coverMatchInput(
      lines(["百诗过园自商国图", 0.426, 678, 100], ["45-90", 0.999, 20, 1000], ["10+", 1, 60, 1000], ["OITICULTURE", 0.954, 161, 300]),
    );
    expect(input.queries).toEqual(["oiticulture"]);
  });

  it("ignores publisher logos, even misread, which are often the biggest text", () => {
    const input = coverMatchInput(lines(["KOSOOS", 0.81, 200, 50], ["DEUTSCHLAND", 0.99, 150, 400], ["FINDEN SIE MINDEN", 0.97, 140, 560]));
    expect(input.queries[0]).toBe("deutschland finden sie minden");
    expect(coverMatchInput(lines(["UBONGO KOSOS", 0.95, 200, 50])).queries[0]).toBe("ubongo");
  });

  it("returns no queries when nothing readable is left", () => {
    expect(coverMatchInput(lines(["2-4", 1, 50, 10], ["@", 0.9, 80, 200])).queries).toEqual([]);
  });
});

describe("extraTitleInputs", () => {
  it("finds other big titles on a photo of several boxes, each with its own two-line partner", () => {
    const shelf = lines(
      ["CATAN", 1, 300, 100, 0, 600],
      ["THE GAME", 0.98, 48, 420, 0, 600],
      ["TERRAFORMING", 1, 110, 100, 700, 1300],
      ["MARS", 1, 170, 220, 700, 1300],
      ["AZUL", 1, 150, 600, 1400, 1900],
    );
    expect(extraTitleInputs(shelf).map((i) => i.queries[0])).toEqual(["terraforming mars", "azul"]);
  });

  it("doesn't turn the main box's own two-line title or small print into extra games", () => {
    const single = lines(["MARS", 0.999, 175, 400], ["TERRAFORMING", 1, 108, 280], ["JACOBFRYXELIUS", 1, 44, 1100]);
    expect(extraTitleInputs(single)).toEqual([]);
  });
});
