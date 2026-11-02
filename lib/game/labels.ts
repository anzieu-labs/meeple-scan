import type { Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill, plural } from "@/lib/i18n/format";

import type { GameCard } from "./types";

/** Below this many ratings the average says little, so the score is shown as "not enough ratings". */
export const MIN_RATINGS = 30;

export type RatingTier = "excellent" | "good" | "average" | "poor" | "none";

export function ratingTier(game: Pick<GameCard, "ratingAverage" | "usersRated">): RatingTier {
  const r = game.ratingAverage;
  if (r == null || game.usersRated < MIN_RATINGS) return "none";
  return r >= 8 ? "excellent" : r >= 7 ? "good" : r >= 6 ? "average" : "poor";
}

type Details = Dictionary["details"];

/** BGG weight (1–5) in words, "Medium-light complexity"; not a judgement, heavier isn't worse. */
export function complexityLabel(weight: number | null, t: Details = en.details) {
  if (weight == null) return null;
  const level =
    weight <= 1.5 ? "light" : weight <= 2.5 ? "mediumLight" : weight <= 3.5 ? "medium" : weight <= 4.5 ? "mediumHeavy" : "heavy";
  return t.complexity[level];
}

/** [1,2,3,5] -> "1–3, 5" */
export function formatCounts(counts: number[]) {
  const ranges: string[] = [];
  for (let i = 0; i < counts.length; i++) {
    let j = i;
    while (j + 1 < counts.length && counts[j + 1] === counts[j] + 1) j++;
    ranges.push(i === j ? `${counts[i]}` : `${counts[i]}–${counts[j]}`);
    i = j;
  }
  return ranges.join(", ");
}

function boxPlayers({ minPlayers: min, maxPlayers: max }: Pick<GameCard, "minPlayers" | "maxPlayers">, t: Details, locale: Locale) {
  if (!min) return null;
  if (!max || max === min) return plural(locale, min, t.players);
  return fill(t.playerRange, { min, max });
}

/**
 * "Best with 4" / "Good with 3–4 · box says 3–4 players", from the community poll; falls back to the
 * publisher's range when too few people voted.
 */
export function playersRow(
  game: Pick<GameCard, "bestPlayers" | "recommendedPlayers" | "minPlayers" | "maxPlayers">,
  t: Details = en.details,
  locale: Locale = "en",
) {
  const box = boxPlayers(game, t, locale);
  if (!game.bestPlayers.length) return box ? { title: box, subtitle: t.fromBox } : null;
  const good = game.recommendedPlayers.length ? fill(t.goodWith, { counts: formatCounts(game.recommendedPlayers) }) : null;
  return {
    title: fill(t.bestWith, { counts: formatCounts(game.bestPlayers) }),
    subtitle: [good, box && fill(t.boxSays, { players: box })].filter(Boolean).join(" · "),
  };
}

/** "Age 10+" with the community's opinion when it has enough votes. */
export function ageRow(game: Pick<GameCard, "minAge" | "communityAge">, t: Details = en.details) {
  const age = game.minAge ?? game.communityAge;
  if (!age) return null;
  return {
    title: fill(t.age, { age }),
    subtitle:
      game.minAge && game.communityAge ? fill(t.communitySays, { age: game.communityAge }) : game.minAge ? t.fromBox : t.communityVote,
  };
}

export function playTimeText(game: Pick<GameCard, "minPlayTime" | "maxPlayTime">, t: Details = en.details) {
  const { minPlayTime: min, maxPlayTime: max } = game;
  if (!min && !max) return null;
  return fill(t.minutes, { time: !max || max === min ? `${min ?? max}` : `${min}–${max}` });
}
