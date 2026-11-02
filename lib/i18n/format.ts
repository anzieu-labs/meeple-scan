import type { Locale } from "./config";
import type { Plural } from "./dictionaries/en";

/** "Best with {counts}" + { counts: "3–4" } -> "Best with 3–4". */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** The form of a sentence for this count in this language ("1 game" / "4 games"), filled with the count. */
export function plural(locale: Locale, count: number, forms: Plural, values: Record<string, string | number> = {}) {
  const rule = new Intl.PluralRules(locale).select(count);
  const form = (rule === "one" || rule === "few" || rule === "many" ? forms[rule] : undefined) ?? forms.other;
  return fill(form, { count: formatNumber(locale, count), ...values });
}

/** 0.93 -> "93%", "93 %" (fr), as the language writes it. */
export function formatPercent(locale: Locale, share: number) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share);
}

export function formatNumber(locale: Locale, n: number) {
  return new Intl.NumberFormat(locale).format(n);
}

/** A BGG rating with one decimal, as the language writes it: 7.1, 7,1. */
export function formatRating(locale: Locale, rating: number) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
}

/** 145099 -> "145K" (en), "145 k" (fr); one decimal below 10 000: "3.6K". */
export function compactCount(locale: Locale, n: number) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: n >= 10_000 ? 0 : 1 }).format(n);
}

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "5 minutes ago", "il y a 5 minutes"; under a minute, "now" in the language's words. */
export function timeAgo(locale: Locale, at: number, now: number) {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const elapsed = now - at;
  for (const [unit, ms] of STEPS) if (elapsed >= ms) return relative.format(-Math.floor(elapsed / ms), unit);
  return relative.format(0, "second");
}
