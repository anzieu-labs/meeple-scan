/** Publishers and distributors printed on boxes but never part of BGG game names. */
const PUBLISHERS = [
  "asmodee",
  "mayfair games",
  "mayfair",
  "hasbro",
  "z-man games",
  "z-man",
  "zman games",
  "fantasy flight games",
  "days of wonder",
  "ravensburger",
  "kosmos",
  "repos production",
  "stonemaier games",
  "rio grande games",
  "plan b games",
  "next move games",
  "cmon",
  "czech games edition",
  "catan studio",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * Strips box noise (publishers, ages, player counts, editions, language tags…) from a line of text and
 * returns the game-name part ("head") plus the whole cleaned text. BGG search matches word by word and
 * stores "&", so "&"/"and" are dropped, not expanded. Apostrophes are kept: "tzolk'in" finds the game,
 * "tzolkin" doesn't.
 */
export function cleanTitle(raw: string, brand: string | null): { head: string; full: string } {
  let s = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[™®©]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/^buy\s+.*?\s+and\s+get\s+/i, " ") // bundle promos: "Buy X and Get Y for FREE"
    .replace(/\s*&\s*|\s+and\s+/gi, " ");
  s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  s = s.replace(/\b(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9]{5,}\b/gi, " "); // retailer SKUs like CGE00026, ZM7810
  for (const name of [brand, ...PUBLISHERS].filter(Boolean) as string[]) {
    s = s.replace(new RegExp(`\\b${escape(name)}\\b`, "gi"), " ");
  }
  s = s.replace(/\s(by|from)\s+.*$/i, " ");
  s = s.replace(/\bfor\s+ages?\s*\d+\s*(\+|and up)?|\bages?\s*\d+\s*(\+|-\s*\d+|and up)?/gi, " ");
  s = s.replace(/\b\d+\s*(-|to)\s*\d+\s*players?\b|\b\d+\+?\s*players?\b/gi, " ");
  s = s.replace(/\b\d+(st|nd|rd|th)\s+edition\b|\bedition\b|\bbase game\b|\bcore set\b/gi, " ");
  // Stacked category words: "Family Tile Strategy Game".
  s = s.replace(/\b((board|card|dice|party|strategy|family|tabletop|tile|co-?op(erative)?)\s+)+games?\b/gi, " ");
  s = s.replace(/\b(family|strategy|kids|adults|games?|for free|multicolou?r|ea|pack)\b|\b\d+(\.\d+)?\s*ea\b/gi, " ");
  // BGG names expansions "Dixit: Daydreams", never "… Expansion"; the matcher reads this word from the raw titles.
  s = s.replace(/\b(expansion|extension|erweiterung|espansione|expansion pack)\b/gi, " ");
  // Language and region tags, including French/German/Italian/Spanish retail wording ("Jeu en français").
  s = s.replace(/\b(english|french|german|spanish|italian|multi(lingual)?)\b(\s*\/\s*\w+)*/gi, " ");
  s = s.replace(/\b(en|in)\s+(francais|anglais|allemand)\b|\b(version\s+)?francaise?\b|\bquebecoise?\b|\bvf\b/gi, " ");
  s = s.replace(/\b(jeux?|spiel|juego|gioco|deutsche?|ausgabe|edicion|edizione|italiano|espanol)\b/gi, " ");

  const parts = s
    .split(/\s[-–—]\s|:/)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^\p{L}\p{N}' ]/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return { head: parts[0] ?? "", full: parts.join(" ") };
}

export interface Phrase {
  phrase: string;
  /** How strongly this query is believed to be the title (bigger text on the box = higher). */
  score: number;
}

export interface MatchInput {
  /** Up to 3 BGG search queries, most likely first. */
  queries: string[];
  phrases: Phrase[];
  /** All text read on the box, for spotting "expansion", "junior", etc. */
  titles: string[];
  /** For another title on the photo: its letter height compared with the main title's. */
  relativeSize?: number;
}
