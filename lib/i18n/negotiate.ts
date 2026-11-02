import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

/** Chinese written in Traditional characters: never shown Simplified Chinese, English instead. */
const TRADITIONAL_CHINESE = /^zh-(hant|tw|hk|mo)\b/;
/** Chinese written in Simplified characters, said outright. */
const SIMPLIFIED_CHINESE = /^zh-(hans|cn|sg)\b/;

/**
 * The app language for a browser's `Accept-Language` ("fr-CA,fr;q=0.9,en;q=0.8"): its languages in order of
 * preference, each matched exactly ("pt-BR"), then by its base language ("fr-CA" -> fr, "pt-PT" -> pt-BR).
 * Traditional Chinese is skipped. English when nothing matches.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  const wanted = (header ?? "")
    .split(",")
    .map((part, order) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag, q: Number.isFinite(q) ? q : 0, order };
    })
    .filter((w) => w.tag && w.tag !== "*" && w.q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order);

  // "zh-TW,zh": a plain "zh" after a Traditional one means Traditional too.
  let traditional = false;
  for (const { tag } of wanted) {
    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    if (TRADITIONAL_CHINESE.test(tag)) {
      traditional = true;
      continue;
    }
    if (tag === "zh" && traditional) continue;
    // Other Chinese variants we can't be sure of ("zh-Latn") aren't guessed either.
    if (tag.startsWith("zh-") && !SIMPLIFIED_CHINESE.test(tag)) continue;
    const base = tag.split("-")[0];
    const sameLanguage = LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === base);
    if (sameLanguage) return sameLanguage;
  }
  return DEFAULT_LOCALE;
}
