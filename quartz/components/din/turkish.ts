/**
 * Turkish alphabet helpers.
 *
 * The site is Turkish-first, so sorting and alphabet bucketing must follow the
 * Turkish alphabet (where "ı" and "i", "I" and "İ" are distinct letters) rather
 * than the browser/Node default collation that would push ç/ğ/ı/ö/ş/ü past "z".
 */

export const TURKISH_ALPHABET = [
  "A",
  "B",
  "C",
  "Ç",
  "D",
  "E",
  "F",
  "G",
  "Ğ",
  "H",
  "I",
  "İ",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ö",
  "P",
  "R",
  "S",
  "Ş",
  "T",
  "U",
  "Ü",
  "V",
  "Y",
  "Z",
] as const

/**
 * Hymns in this vault sometimes begin with an Ottoman-era circumflex
 * ("Âlem", "Îsâ", "Ûdî"), which belongs under the base letter in an index.
 */
const FOLD_TO_BASE: Record<string, string> = {
  Â: "A",
  Ä: "A",
  Î: "I",
  Ï: "I",
  Û: "U",
  Ô: "O",
  É: "E",
}

const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true })

/** Alphabetical comparison using Turkish collation. */
export function turkishCompare(a: string, b: string): number {
  return collator.compare(a, b)
}

/** The index letter a title belongs under ("A", "Ç", "İ", …), or "#". */
export function bucketLetter(title: string): string {
  const first = (title ?? "").trim().charAt(0)
  if (!first) return "#"
  const upper = first.toLocaleUpperCase("tr")
  return FOLD_TO_BASE[upper] ?? upper
}

/**
 * URL-safe anchor id for a letter. Turkish lowercasing keeps "I" → "ı" and
 * "İ" → "i" apart, so the two letters never collide.
 */
export function letterAnchor(letter: string): string {
  return `harf-${letter.toLocaleLowerCase("tr")}`
}
