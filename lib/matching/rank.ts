import * as fuzz from "fuzzball";

import type { BggGame } from "@/lib/bgg/parse";

import type { MatchInput } from "./clean";

/** Comparison form: lowercase, no accents, apostrophes removed, "&"/"and" dropped. */
export function normalizeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/&|\band\b/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (s: string) => s.split(" ").filter(Boolean);

/**
 * Small linking words inside titles that boxes print tiny (or OCR drops): "KING TOKYO" is King of Tokyo.
 * Articles still count: "GRANDE" (the Rio Grande logo) isn't El Grande, "MARS" isn't The Mars.
 */
const LINKING_WORDS = new Set(["of", "de", "du", "des", "der"]);

/** The name without linking words, unless that leaves nothing ("The Game"). */
function withoutLinkingWords(normalized: string) {
  const kept = tokens(normalized).filter((t) => !LINKING_WORDS.has(t));
  return kept.length ? kept.join(" ") : normalized;
}

/** "Le Seigneur des Anneaux: La Communauté de l'Anneau, Le jeu de plis" -> its 3 parts. */
const NAME_PARTS = /\s*(?::|,|–|—| - |\()\s*/;

/** A box may show just one part of a long name; that counts, but less than the whole name. */
const PART_CREDIT = 0.75;

/**
 * Similarity of a query and a game name in [~-0.5, 1], linking words ignored. token_set_ratio is
 * deliberately not used: it scores "catan" 100 against "Catan Junior". Extra words in the name cost a
 * little each. A name in several parts is also compared part by part, at reduced credit, so "communaute
 * de l'anneau" finds "Le Seigneur des Anneaux: La Communauté de l'Anneau, Le jeu de plis coopératif".
 */
export function nameSimilarity(query: string, name: string): number {
  const whole = wholeNameSimilarity(query, name);
  const parts = name.split(NAME_PARTS).filter(Boolean);
  if (parts.length < 2) return whole;
  return Math.max(whole, ...parts.map((part) => PART_CREDIT * wholeNameSimilarity(query, part)));
}

const squashed = (s: string) => s.replace(/ /g, "");

function wholeNameSimilarity(query: string, name: string) {
  const q = withoutLinkingWords(normalizeName(query));
  const n = withoutLinkingWords(normalizeName(name));
  if (!q || !n) return 0;
  if (q === n) return 1;
  // OCR often drops the space between big letters: "FORSALE" is For Sale. Just below an exact match, so
  // "city line" is City Line before Cityline.
  if (squashed(q) === squashed(n)) return 0.97;
  const qTokens = new Set(tokens(q));
  const extra = tokens(n).filter((t) => !qTokens.has(t)).length;
  const lev = 1 - fuzz.distance(q, n) / Math.max(q.length, n.length);
  return 0.6 * (fuzz.token_sort_ratio(q, n) / 100) + 0.4 * lev - 0.08 * extra;
}

/**
 * How many title lines a game's name explains in full: "CREW" and "MISSION DEEP SEA" both are The Crew:
 * Mission Deep Sea, only one is The Crew: The Quest for Planet Nine.
 */
function linesExplained(game: BggGame, lines: string[]) {
  return Math.max(
    ...[game.name, ...(game.alternateNames ?? [])].map((n) => lines.filter((line) => coverage(line, n) === 1).length),
  );
}

/** Share of the query's words found in the name (apostrophes and "&" ignored). */
function coverage(query: string, name: string) {
  const nameTokens = new Set(tokens(normalizeName(name)));
  const q = tokens(normalizeName(query));
  return q.length ? q.filter((t) => nameTokens.has(t)).length / q.length : 0;
}

const SPIN_OFF = /\b(junior|kids|travel|dice|card game|my first)\b/i;
const EXPANSION_WORDS = /\b(expansion|extension|exp\.|add-on)\b/i;

export interface RankedCandidate {
  game: BggGame;
  score: number;
  nameScore: number;
}

/**
 * Ranks BGG candidates for a product. Each candidate is compared with every query (later queries count
 * slightly less), whichever query found it: "tzolk'in" finds the expansion, but
 * "tzolkin tribes prophecies" is what identifies it.
 * Score = 0.60·name + 0.15·each further title line explained + 0.25·popularity + 0.05·publisher
 * + 0.05·query support − penalties; then a game whose name the box spells out in full outranks a shorter
 * one (see below).
 */
export function rankCandidates(candidates: BggGame[], input: MatchInput, brand: string | null): RankedCandidate[] {
  const titleText = input.titles.join(" ");
  const titleSaysExpansion = EXPANSION_WORDS.test(titleText);
  const titleSaysSpinOff = SPIN_OFF.test(titleText);
  const allNames = (g: BggGame) => [g.name, ...(g.alternateNames ?? [])];
  // Prefer a base game whose name explains the main query ("catan" -> Catan, not Catan: Seafarers).
  const mainQuery = input.queries[0] ?? "";
  const titleLines = input.queries.filter((q) => tokens(normalizeName(q)).some((t) => !GENERIC_WORDS.has(t)));
  const baseCoversQuery = candidates.some(
    (g) => g.type === "boardgame" && allNames(g).some((n) => coverage(mainQuery, n) === 1),
  );

  const ranked = candidates.map((game) => {
    let nameScore = -Infinity;
    let query = mainQuery;
    input.queries.forEach((q, i) => {
      const discount = 1 - 0.05 * i;
      const best = Math.max(
        nameSimilarity(q, game.name),
        // Another language's name counts less, unless it's exactly the main title on the box: a side line
        // like "duel", or "imperium" from Dune: Imperium, can be some little-known game's name elsewhere.
        ...(game.alternateNames ?? []).map((n) => {
          const similarity = nameSimilarity(q, n);
          return i === 0 && similarity >= 1 ? similarity : 0.85 * similarity;
        }),
      );
      if (best * discount > nameScore) [nameScore, query] = [best * discount, q];
    });
    const popularity = Math.min(1, Math.log10((game.usersRated ?? 0) + 1) / 5);
    const publisher =
      brand && (game.publishers ?? []).some((p) => p.toLowerCase().includes(brand.toLowerCase())) ? 1 : 0;
    const support = Math.min(1, input.phrases.find((p) => p.phrase === query)?.score ?? 0);
    const expansionPenalty = game.type === "boardgameexpansion" && !titleSaysExpansion && baseCoversQuery ? 0.25 : 0;
    const spinOffPenalty = SPIN_OFF.test(game.name) && !titleSaysSpinOff ? 0.15 : 0;
    const score =
      0.6 * nameScore +
      0.15 * Math.max(0, linesExplained(game, titleLines) - 1) +
      0.25 * popularity +
      0.05 * publisher +
      0.05 * support -
      expansionPenalty -
      spinOffPenalty;
    return { game, score, nameScore };
  });
  preferNamesTheBoxSpells(ranked, input);
  return ranked.sort((a, b) => b.score - a.score);
}

/**
 * Words too common to tell an edition apart: a stray "SECOND" from the next box on a shelf isn't
 * Gloomhaven (Second Edition).
 */
const GENERIC_WORDS = new Set("the a an game board edition first second third 2nd 3rd revised deluxe".split(" "));

/**
 * "VITICULTURE ESSENTIAL" is Viticulture Essential Edition, not Viticulture: a game whose name is another
 * candidate's name plus words also read in the title lines outranks it, though that candidate matches one
 * line exactly. Words are matched with spaces removed, since OCR merges them ("ENDEAVOR DEEPSEA"). Only
 * the longer game's own name counts: an alternate name like "Mexican Train Dominoes" for Dominoes would
 * outrank Mexican Train.
 */
function preferNamesTheBoxSpells(ranked: RankedCandidate[], input: MatchInput) {
  const read = squashed(withoutLinkingWords(normalizeName(input.queries.join(" "))));
  const nameTokens = (g: BggGame) =>
    [g.name, ...(g.alternateNames ?? [])].map((n) => tokens(withoutLinkingWords(normalizeName(n))));
  const spells = (longer: BggGame, shorter: BggGame) => {
    const long = tokens(withoutLinkingWords(normalizeName(longer.name)));
    const longSet = new Set(long);
    const shorterName = new Set(tokens(normalizeName(shorter.name)));
    return nameTokens(shorter).some((short) => {
      if (short.length >= long.length || !short.every((t) => longSet.has(t))) return false;
      // Words of the shorter game's own name don't count: Great Western Trail is also "Great Western", which
      // its second edition doesn't outspell with "trail".
      const extra = long.filter((t) => !short.includes(t) && !shorterName.has(t) && !GENERIC_WORDS.has(t));
      return extra.length > 0 && extra.every((t) => t.length >= 3 && read.includes(t));
    });
  };
  // Decided on the original scores, so the order of the loop doesn't matter; promoted games keep their
  // order among themselves (Great Western Trail stays ahead of its second edition, both spelling "trail").
  const promotions = ranked.map((longer) => {
    const beaten = ranked.filter((shorter) => shorter.score > longer.score && spells(longer.game, shorter.game));
    if (!beaten.length) return null;
    const top = beaten.reduce((a, b) => (b.score > a.score ? b : a));
    return { score: top.score + 0.01 + 0.01 * longer.score, nameScore: Math.max(longer.nameScore, top.nameScore) };
  });
  promotions.forEach((promotion, i) => {
    if (promotion) Object.assign(ranked[i], promotion);
  });
}

/** A clear winner is shown as the match. */
export const AUTO_ACCEPT = { minScore: 0.68, minMargin: 0.1, minNameScore: 0.85 };
/** Anything less clear but still name-like is shown as a best guess the user can correct. */
export const MIN_GUESS_NAME_SCORE = 0.25;

/** auto: clear winner · guess: show the top candidate, flagged as unsure · none: nothing worth showing. */
export function decide(ranked: RankedCandidate[]): "auto" | "guess" | "none" {
  const [top, second] = ranked;
  if (!top || top.nameScore < MIN_GUESS_NAME_SCORE) return "none";
  const confident =
    top.score >= AUTO_ACCEPT.minScore &&
    top.score - (second?.score ?? 0) >= AUTO_ACCEPT.minMargin &&
    top.nameScore >= AUTO_ACCEPT.minNameScore;
  return confident ? "auto" : "guess";
}
