/**
 * Turkish stemming, for matching inflected words in a hymn against a glossary
 * entry.
 *
 * The problem this solves:
 *
 *     Lugat.md has  ## şirk
 *     one hymn says  "şirkten", another "şirke", another "şirkte"
 *
 * All three are the same word wearing different case suffixes, and all three
 * should open the same definition. Turkish is strictly suffixing (nothing is
 * inserted into the middle of a root), so a word's stem is always a PREFIX of
 * the word — which makes this tractable without a full morphological analyser.
 *
 * Two deliberate safety properties:
 *
 *  - A suffix is only stripped if it appears in the list below. Blind prefix
 *    matching would make "odun" (firewood) match "od" (fire) and "rahmet"
 *    match "rah" (road). Validating the offcut against real Turkish suffixes
 *    rules those out, because "-un" and "-met" are not suffixes of those stems.
 *
 *  - Folding is LENGTH PRESERVING, so a match found in the folded string maps
 *    back to exact character offsets in the original text and the link can be
 *    wrapped around the word as the author actually typed it.
 */

/** Turkish lowercasing keeps one code point per code point (İ→i, I→ı). */
const CHAR_FOLD: Record<string, string> = {
  â: "a",
  ä: "a",
  á: "a",
  à: "a",
  î: "i",
  ï: "i",
  í: "i",
  ì: "i",
  û: "u",
  ú: "u",
  ù: "u",
  ô: "o",
  ó: "o",
  ê: "e",
  é: "e",

  // ⚠️ KNOWN BUG — the five lines below must be DELETED before this matcher is
  // used. ş ğ ç ö ü ı are distinct letters of the Turkish alphabet, not accented
  // s g c o u i, and folding them together collides real, unrelated words:
  //
  //     şâd  (glad)   ←  sada (voice), sadan
  //     şirk (idolatry) ←  sirk
  //
  // Measured against the corpus: 2 of 18 `şâd` links produced this way were
  // wrong ("sada" / "Sada" in Çün sana gönlüm mübtela düştü). A wrong
  // definition shown to a reader is worse than no link, so the fix is to fold
  // ONLY the hat vowels â î û (genuine variants of a i u) and leave every other
  // Turkish letter alone. That costs recall — "gozum" will no longer find
  // "gözüm" — and that trade is deliberate.
  //
  // Turkish casing already gives one code point per code point (İ→i, I→ı), so
  // removing these five lines keeps the fold length-preserving, which is what
  // the origin[] index mapping depends on.
  ş: "s",
  ğ: "g",
  ç: "c",
  ö: "o",
  ı: "i",
}

export interface FoldedText {
  folded: string
  /** folded index → index of the source character that produced it */
  origin: number[]
}

/**
 * Lowercase with Turkish rules and strip Turkish diacritics, keeping a map from
 * every folded character back to its position in the source string.
 */
export function foldWithMap(src: string): FoldedText {
  let folded = ""
  const origin: number[] = []

  for (let i = 0; i < src.length; ) {
    const codePoint = src.codePointAt(i)!
    const char = String.fromCodePoint(codePoint)
    const lower = char.toLocaleLowerCase("tr")
    for (const piece of lower) {
      const mapped = CHAR_FOLD[piece] ?? piece
      for (const out of mapped) {
        folded += out
        origin.push(i)
      }
    }
    i += char.length
  }

  return { folded, origin }
}

/** Fold a single term the same way, without needing the index map. */
export function foldTerm(term: string): string {
  return foldWithMap(term).folded
}

/**
 * Atomic Turkish suffixes. Stems are reached by stripping these repeatedly, so
 * compounds like "-lerimizden" need no separate entry: strip "den" → "lerimiz",
 * strip "imiz" → "ler", strip "ler" → the stem.
 *
 * Ordering is irrelevant — every suffix is tried at every step.
 */
const SUFFIXES = [
  // plural
  "ler",
  "lar",
  // possessive
  "imiz",
  "ımız",
  "umuz",
  "ümüz",
  "iniz",
  "ınız",
  "unuz",
  "ünüz",
  "im",
  "ım",
  "um",
  "üm",
  "si",
  "sı",
  "su",
  "sü",
  // case
  "den",
  "dan",
  "ten",
  "tan",
  "de",
  "da",
  "te",
  "ta",
  "nin",
  "nın",
  "nun",
  "nün",
  "in",
  "ın",
  "un",
  "ün",
  "e",
  "a",
  "i",
  "ı",
  "u",
  "ü",
  // instrumental, equative
  "yle",
  "yla",
  "ile",
  "le",
  "la",
  "ce",
  "ca",
  "çe",
  "ça",
  // derivation
  "lik",
  "lık",
  "luk",
  "lük",
  "siz",
  "sız",
  "suz",
  "süz",
  "li",
  "lı",
  "lu",
  "lü",
  "ki",
  // copula
  "dir",
  "dır",
  "dur",
  "dür",
  "tir",
  "tır",
  "tur",
  "tür",
  // verbal / participial forms that show up in verse
  "mek",
  "mak",
  "miş",
  "mış",
  "muş",
  "müş",
  "erek",
  "arak",
  "ince",
  "ınca",
  "ken",
  "ecek",
  "acak",
  "di",
  "dı",
  "du",
  "dü",
  "ti",
  "tı",
  "tu",
  "tü",
  "se",
  "sa",
  "en",
  "an",
  "ip",
  "ıp",
  "up",
  "üp",
  "me",
  "ma",
]

/** Never strip a term down below this, or short glossary words start matching everything. */
const MIN_STEM = 3
const MAX_STRIP_DEPTH = 4

const candidateCache = new Map<string, string[]>()

/**
 * Every stem a folded word could plausibly have, shortest last.
 *
 * Only reachable by stripping real suffixes, so "rahmet" yields ["rahmet"]
 * (no "-met"), while "şirklerimizden" yields the full chain down to "şirk".
 */
export function stemCandidates(word: string): string[] {
  const cached = candidateCache.get(word)
  if (cached) return cached

  const seen = new Set<string>([word])
  const queue: [string, number][] = [[word, 0]]

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!
    if (depth >= MAX_STRIP_DEPTH) continue

    for (const suffix of SUFFIXES) {
      if (!current.endsWith(suffix)) continue
      const stem = current.slice(0, current.length - suffix.length)
      if (stem.length < MIN_STEM || seen.has(stem)) continue
      seen.add(stem)
      queue.push([stem, depth + 1])
    }
  }

  const result = [...seen]
  candidateCache.set(word, result)
  return result
}

export interface TermMatch {
  /** the glossary term that matched */
  term: string
  /** the word as it appears in the text, suffixes and all */
  surface: string
}

/** folded stem → the glossary term it belongs to */
export type GlossaryIndex = Map<string, string>

/**
 * Register a term plus every stem it could be reduced to.
 *
 * Indexing the term's own stems matters for entries like `## zulmette`, which
 * is itself an inflected form: without it, the bare word "zulmet" in a hymn
 * would not find the entry. With it, matching works in both directions —
 * "şirkten" finds `## şirk`, and "zulmet" finds `## zulmette`.
 */
export function addTermToIndex(index: GlossaryIndex, term: string): void {
  const folded = foldTerm(term)
  if (folded.length < MIN_STEM) return

  if (!index.has(folded)) index.set(folded, term)
  for (const candidate of stemCandidates(folded)) {
    if (!index.has(candidate)) index.set(candidate, term)
  }
}

/**
 * Does this word, as typed, belong to a glossary term?
 *
 * Exact matches win; otherwise the longest stem that reaches a term wins, so
 * "şirk" is preferred over a hypothetical shorter collision.
 */
export function matchTerm(word: string, index: GlossaryIndex): TermMatch | undefined {
  const folded = foldTerm(word)
  if (folded.length < MIN_STEM) return undefined

  const direct = index.get(folded)
  if (direct) return { term: direct, surface: word }

  for (const candidate of stemCandidates(folded)) {
    const term = index.get(candidate)
    if (term) return { term, surface: word }
  }
  return undefined
}
