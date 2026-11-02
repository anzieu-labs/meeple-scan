import * as fuzz from "fuzzball";

import { cleanTitle, type MatchInput } from "./clean";

/** One line of text found on a box cover by the OCR service. */
export interface OcrLine {
  text: string;
  score: number;
  /** [x0, y0, x1, y1] in image pixels. */
  box: [number, number, number, number];
}

/** OCR confidence below which a line is ignored; lines read at 0.5–0.6 still found more games in ocr-eval. */
const MIN_SCORE = 0.5;
/** Ages, player counts, play times, prices and URLs printed on boxes. */
const NOISE =
  /^\d+\s*\+$|\b\d+\s*[-–]\s*\d+\b|\bmin(ute)?s?\b|\bans\b|\bjahre\b|\bages?\b|\bplayers?\b|\bjoueurs?\b|www\.|\.com\b|[$€£]/i;
/** Another title on the same photo must be at least this big compared with the biggest text. */
const MIN_EXTRA_TITLE_HEIGHT = 0.3;

/**
 * Publisher logos printed big on boxes, which OCR often reads as the biggest text ("KOSMOS", misread as
 * "kosoos" or "komos"). Long ones are matched loosely, as a word anywhere in a line; short or multi-word
 * ones only as the whole line.
 */
const LOGO_WORDS = [
  "kosmos",
  "matagot",
  "asmodee",
  "ravensburger",
  "gigamic",
  "libellud",
  "stonemaier",
  "uberplay",
  "spiele",
];
const LOGO_LINES = [
  "alea",
  "aeg",
  "gmt",
  "iello",
  "haba",
  "masque",
  "scorpion masque",
  "next move",
  "days of wonder",
  "rio grande",
  "z man",
  "hans im gluck",
  "czech games",
  "plaid hat",
  "space cowboys",
  "repos production",
];

/** The line without publisher logos ("ubongo kosos" -> "ubongo"), empty when it was only a logo. */
function withoutLogos(clean: string) {
  if (LOGO_LINES.some((logo) => fuzz.ratio(clean, logo) >= 85)) return "";
  return clean
    .split(" ")
    .filter((word) => !(word.length >= 4 && LOGO_WORDS.some((logo) => fuzz.ratio(word, logo) >= 70)))
    .join(" ");
}

interface Scored extends OcrLine {
  height: number;
  clean: string;
}

const height = (line: OcrLine) => line.box[3] - line.box[1];
const overlapX = (a: OcrLine, b: OcrLine) => Math.min(a.box[2], b.box[2]) - Math.max(a.box[0], b.box[0]);

/** Readable, non-noise lines, biggest letters first. */
function usableLines(lines: OcrLine[]): Scored[] {
  return lines
    .filter((line) => line.score >= MIN_SCORE && !NOISE.test(line.text))
    .map((line) => ({ ...line, height: height(line), clean: withoutLogos(cleanTitle(line.text, null).full) }))
    .filter((line) => line.clean.replace(/[^\p{L}]/gu, "").length >= 2)
    .sort((a, b) => b.height - a.height);
}

/** Vertical space between two lines (negative when they overlap). */
const gapY = (a: OcrLine, b: OcrLine) => Math.max(a.box[1], b.box[1]) - Math.min(a.box[3], b.box[3]);

/**
 * The second half of a title printed over two lines: the closest similarly sized line right under or over
 * it. The gap is measured against the smaller line, so a big title doesn't reach over to another box.
 */
function partnerOf(line: Scored, pool: Scored[]) {
  return pool
    .filter(
      (other) =>
        other !== line &&
        // "BIRMINGHAM" under "BRASS" is ~30% of its height.
        other.height >= 0.28 * line.height &&
        overlapX(other, line) > 0 &&
        gapY(other, line) < 1.2 * Math.min(other.height, line.height),
    )
    .sort((a, b) => gapY(a, line) - gapY(b, line))[0];
}

const joinTitle = (line: Scored, partner: Scored | undefined) =>
  partner
    ? [line, partner]
        .sort((a, b) => a.box[1] - b.box[1])
        .map((l) => l.clean)
        .join(" ")
    : null;

function toInput(candidates: (string | null | undefined)[], titles: string[], max: number): MatchInput {
  const queries: string[] = [];
  for (const query of candidates) {
    if (query && !queries.includes(query) && queries.length < max) queries.push(query);
  }
  // Bigger text = more likely the title: the ranker gives the first query a little extra support.
  return { queries, phrases: queries.map((phrase, i) => ({ phrase, score: 1 - 0.3 * i })), titles };
}

/**
 * Turns OCR lines into BGG search queries for the main game on the photo. The title is usually the
 * biggest text on the cover, so lines are ranked by letter height; a title split over two lines
 * ("TICKET TO" / "RIDE") is joined.
 */
export function coverMatchInput(lines: OcrLine[]): MatchInput {
  const usable = usableLines(lines);
  if (!usable.length) return { queries: [], phrases: [], titles: [] };
  const [top, second, third] = usable;
  return toInput(
    [joinTitle(top, partnerOf(top, usable)), top.clean, second?.clean, third?.clean],
    usable.map((l) => l.text),
    3,
  );
}

/**
 * Other big titles on the same photo (several boxes in one shot), each as its own search, main title
 * excluded. A candidate takes its two-line partner with it, so "TERRAFORMING / MARS" isn't split into
 * two games. Whether a candidate really is another game is decided after matching.
 */
export function extraTitleInputs(lines: OcrLine[], max = 4): MatchInput[] {
  const usable = usableLines(lines);
  if (usable.length < 2) return [];
  const [top] = usable;
  const used = new Set<Scored>([top]);
  const topPartner = partnerOf(top, usable);
  if (topPartner) used.add(topPartner);

  const inputs: MatchInput[] = [];
  for (const line of usable.slice(1)) {
    if (inputs.length >= max || line.height < MIN_EXTRA_TITLE_HEIGHT * top.height) break;
    if (used.has(line)) continue;
    const partner = partnerOf(
      line,
      usable.filter((l) => !used.has(l)),
    );
    used.add(line);
    if (partner) used.add(partner);
    inputs.push({
      ...toInput([joinTitle(line, partner), line.clean], [line.text, partner?.text ?? ""].filter(Boolean), 2),
      relativeSize: line.height / top.height,
    });
  }
  return inputs;
}
