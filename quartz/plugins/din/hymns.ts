import fs from "fs"
import path from "path"
import GithubSlugger from "github-slugger"
import { visit } from "unist-util-visit"
import { toString } from "hast-util-to-string"
import { QuartzTransformerPlugin } from "../types"
import { FullSlug } from "../../util/path"
import {
  GlossaryIndex,
  addTermToIndex,
  foldTerm,
  foldWithMap,
  matchTerm,
} from "./turkishStem"

/**
 * Project-local transformer for the hymn corpus (`din-vault/ilahiler/`).
 *
 * The vault is the author's live Obsidian workspace and is published read-only,
 * so these fixes happen at build time rather than in the notes.
 *
 * 1. TAB COLUMNS → LINE BREAKS
 *    69 of 293 hymns encode a two-column layout with tab characters: stanza 2 is
 *    typed to the right of stanza 1, separated by a TAB. That pairing only
 *    exists in Obsidian's source view; in HTML a tab collapses to a space and
 *    welds two stanzas into one line. File order is already 1, 2, 3, 4…, so the
 *    tab becomes a newline.
 *
 * 2. ATTRIBUTION LINES → CAPTIONS
 *    "(Yazan: …)" is stored as prose, not frontmatter, and is often indented to
 *    the right. An indented line cannot interrupt a paragraph in CommonMark, so
 *    it was being swallowed into the final verse line — 92 notes were affected.
 *
 * 3. GLOSSARY AUTO-LINKING
 *    Every occurrence of a Lugat.md term inside a hymn becomes a link to that
 *    entry, so the popover is reachable wherever the word appears — no
 *    hand-written [[Lugat#…]] needed. Inflected forms resolve to their stem, so
 *    "şirkten", "şirke" and "şirkte" all open `## şirk`. See turkishStem.ts.
 *
 * Deliberately NOT handled: the `%%…%%` per-hymn glossary. That block is
 * wrapped in Obsidian's comment syntax on purpose — it is the author's working
 * definition list, kept off the hymn page — and `%%` comments are stripped by
 * ObsidianFlavoredMarkdown for the same reason.
 */

const MAX_META_LENGTH = 140

const ATTRIBUTION_FIELD_RE =
  /^(yazan|makam|vezin|kafiye|usul|beste|bestek[âa]r|güfte|söz|şair|şâir)$/i

/** Elements whose text must never be auto-linked. */
const SKIP_TAGS = new Set(["a", "code", "pre", "script", "style", "h1", "h2", "h3", "h4", "h5", "h6"])

/* ------------------------------------------------------------------ *
 * Text normalisation
 * ------------------------------------------------------------------ */

/** True when the whole line is just an attribution, ignoring indentation. */
function isAttributionLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return false
  const inner = trimmed.slice(1, -1)
  const colon = inner.search(/[:：]/)
  if (colon === -1) return false
  return ATTRIBUTION_FIELD_RE.test(inner.slice(0, colon).trim())
}

/**
 * Rewrite tab-based column layout into ordinary line breaks.
 *
 * Order matters: strip leading indentation first, then split on the tabs that
 * separate two stanzas, then drop tabs left dangling at end of line (29 lines
 * in the corpus have one used purely for right-alignment).
 */
export function normalizeTabs(src: string): string {
  return src
    .replace(/\r\n?/g, "\n")
    .replace(/^[ \t]*\t[ \t]*/gm, "")
    .replace(/(\S)[ \t]*\t[ \t]*(\S)/g, "$1\n$2")
    .replace(/[ \t]*\t[ \t]*(?=\n|$)/g, "")
}

/**
 * De-indent attribution lines and give them their own paragraph — blank lines
 * on BOTH sides, because in several notes the next line follows immediately and
 * the two would otherwise merge. Also splits an attribution typed onto the end
 * of a verse line after a run of spaces.
 */
export function isolateAttributions(src: string): string {
  const lines = src.split("\n")
  const out: string[] = []
  const breakParagraph = () => {
    if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("")
  }

  for (const line of lines) {
    const trailing = /^(.*\S)[ \t]{2,}(\([^()]*\))[ \t]*$/.exec(line)
    if (trailing && isAttributionLine(trailing[2])) {
      out.push(trailing[1])
      breakParagraph()
      out.push(trailing[2])
      breakParagraph()
      continue
    }

    if (isAttributionLine(line)) {
      breakParagraph()
      out.push(line.trim())
      breakParagraph()
      continue
    }

    out.push(line)
  }

  return out.join("\n")
}

/* ------------------------------------------------------------------ *
 * Glossary
 * ------------------------------------------------------------------ */

interface GlossaryEntry {
  term: string
  anchor: string
}

interface Glossary {
  /** folded stem → term */
  index: GlossaryIndex
  /** term → its heading anchor on the Lugat page */
  anchors: Map<string, string>
  /** compound terms ("bahr-ı muhit"), matched as phrases rather than words */
  phrases: { regex: RegExp; entry: GlossaryEntry }[]
}

function readIfExists(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8")
  } catch {
    return undefined
  }
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Build a matcher for a multi-word term such as "bahr-ı muhit". The words are
 * joined with a short, flexible separator so "bahri muhit", "bahr-ı muhit" and
 * "bahrımuhit" all match, and the final word may carry a suffix.
 */
function buildPhraseRegex(term: string): RegExp | null {
  const runs = foldTerm(term).match(/[a-z0-9]+/g)
  if (!runs || runs.length < 2) return null
  const body = runs.map(escapeRegex).join("[^a-z0-9]{0,3}")
  return new RegExp(`(?<![a-z0-9])${body}[a-z]*(?![a-z])`, "gi")
}

function buildGlossary(contentDir: string, glossaryFile: string): Glossary {
  const index: GlossaryIndex = new Map()
  const anchors = new Map<string, string>()
  const phrases: Glossary["phrases"] = []

  const glossary = readIfExists(path.join(contentDir, glossaryFile))
  if (!glossary) return { index, anchors, phrases }

  const slugger = new GithubSlugger()
  const entries: GlossaryEntry[] = []
  for (const line of glossary.split(/\r?\n/)) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    // rehype-slug runs github-slugger over the headings in document order, so
    // feeding them in the same order produces the same ids.
    entries.push({ term: match[1], anchor: slugger.slug(match[1]) })
  }

  for (const entry of entries) {
    addTermToIndex(index, entry.term)
    anchors.set(entry.term, entry.anchor)
    const regex = buildPhraseRegex(entry.term)
    if (regex) phrases.push({ regex, entry })
  }

  // Lugat-variations.md: "ma'bûd = mabud = mâbud" — the first spelling is
  // canonical and every variant resolves to the same entry.
  const variations = readIfExists(path.join(contentDir, "Lugat-variations.md"))
  if (variations) {
    for (const line of variations.split(/\r?\n/)) {
      const clean = line.trim()
      if (!clean || clean.startsWith("#")) continue
      const terms = clean
        .split("=")
        .map((t) => t.trim())
        .filter(Boolean)
      const canonical = entries.find((e) => e.term === terms[0] || foldTerm(e.term) === foldTerm(terms[0]))
      if (!canonical) continue
      for (const term of terms) {
        addTermToIndex(index, term)
      }
    }
  }

  return { index, anchors, phrases }
}

/* ------------------------------------------------------------------ *
 * Auto-linking
 * ------------------------------------------------------------------ */

interface Range {
  start: number
  end: number
  term: string
}

/** Merge overlapping matches, keeping the longest at each position. */
function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Range[] = []
  for (const range of sorted) {
    const last = out[out.length - 1]
    if (last && range.start < last.end) {
      if (range.end > last.end) last.end = range.end
      continue
    }
    out.push({ ...range })
  }
  return out
}

function findMatches(text: string, glossary: Glossary): Range[] {
  const { folded, origin } = foldWithMap(text)
  if (folded.length !== text.length) return [] // mapping is not 1:1; stay safe

  const ranges: Range[] = []

  // compound terms first — they win over their constituent words
  for (const { regex, entry } of glossary.phrases) {
    regex.lastIndex = 0
    for (const match of folded.matchAll(regex)) {
      const start = match.index!
      ranges.push({ start, end: start + match[0].length, term: entry.term })
    }
  }

  // then single words, matched on their stem
  for (const match of folded.matchAll(/[a-z0-9]+/g)) {
    const word = match[0]
    if (word.length < 3) continue
    const hit = matchTerm(word, glossary.index)
    if (!hit) continue
    const start = match.index!
    ranges.push({ start, end: start + word.length, term: hit.term })
  }

  return mergeRanges(ranges).filter((r) => r.end <= text.length)
}

function linkTextNode(node: any, glossary: Glossary, href: (anchor: string) => string): any[] | null {
  const text: string = node.value
  if (!text || !/[A-Za-zÀ-ÿĞğİıŞşÇçÖöÜüÂâÎîÛû]/.test(text)) return null

  const ranges = findMatches(text, glossary)
  if (ranges.length === 0) return null

  const out: any[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) out.push({ type: "text", value: text.slice(cursor, range.start) })
    const anchor = glossary.anchors.get(range.term)
    const surface = text.slice(range.start, range.end)
    if (!anchor) {
      out.push({ type: "text", value: surface })
    } else {
      out.push({
        type: "element",
        tagName: "a",
        properties: { href: href(anchor), className: ["lugat-link"] },
        children: [{ type: "text", value: surface }],
      })
    }
    cursor = range.end
  }
  if (cursor < text.length) out.push({ type: "text", value: text.slice(cursor) })

  return out
}

function autoLinkTree(tree: any, glossary: Glossary, href: (anchor: string) => string): void {
  const walk = (node: any, skip: boolean) => {
    if (!Array.isArray(node.children)) return

    if (!skip) {
      const next: any[] = []
      let changed = false
      for (const child of node.children) {
        if (child.type === "text") {
          const replacement = linkTextNode(child, glossary, href)
          if (replacement) {
            next.push(...replacement)
            changed = true
            continue
          }
        }
        next.push(child)
      }
      if (changed) node.children = next
    }

    for (const child of node.children) {
      if (child.type !== "element") continue
      const classes = child.properties?.className
      const isMeta = Array.isArray(classes) && classes.includes("hymn-meta")
      walk(child, skip || SKIP_TAGS.has(child.tagName) || isMeta)
    }
  }

  walk(tree, false)
}

/* ------------------------------------------------------------------ *
 * The plugin
 * ------------------------------------------------------------------ */

export interface DinHymnsOptions {
  /** file name of the master glossary inside the content folder */
  glossaryFile?: string
  /** turn the automatic [[Lugat#…]] linking on or off */
  autoLinkGlossary?: boolean
}

export const DinHymns: QuartzTransformerPlugin<DinHymnsOptions> = (userOpts) => {
  const opts: Required<DinHymnsOptions> = {
    glossaryFile: userOpts?.glossaryFile ?? "Lugat.md",
    // OFF by default, deliberately. The auto-linker as written is SITE-WIDE:
    // any term in Lugat.md lights up in every hymn. That is not the agreed
    // design — the scope is meant to be the hymn's OWN lügatçe, with Lugat.md
    // only supplying the link. Until that is rewritten, defaulting this to true
    // would silently apply the wrong behaviour to every build.
    //
    // It is also not precision-safe yet: turkishStem.ts still folds ş ğ ç ö ü ı
    // into s g c o u i, which are distinct Turkish LETTERS, not accents. That
    // makes "sada" (voice) match `## şâd` (glad) — a wrong definition shown to
    // a reader, which is worse than no link.
    //
    // Both must be fixed before this goes back on. See the notes in
    // turkishStem.ts.
    autoLinkGlossary: userOpts?.autoLinkGlossary ?? false,
  }

  return {
    name: "DinHymns",

    textTransform(_ctx, src) {
      return isolateAttributions(normalizeTabs(src))
    },

    htmlPlugins(ctx) {
      let glossary: Glossary | undefined

      return [
        () => (tree: any, file: any) => {
          // attribution captions
          visit(tree, "element", (node: any) => {
            if (node.tagName !== "p") return
            const value = toString(node).replace(/\s+/g, " ").trim()
            if (value.length === 0 || value.length > MAX_META_LENGTH) return
            const isCaption =
              isAttributionLine(value) || /^(yazan|makam|vezin|kafiye)\s*[:：]/i.test(value)
            if (!isCaption) return

            const existing = node.properties?.className
            const classes = Array.isArray(existing) ? existing : existing ? [existing] : []
            node.properties = { ...node.properties, className: [...classes, "hymn-meta"] }
          })

          if (!opts.autoLinkGlossary) return

          // Only inside hymns: linking Lugat.md to itself, or a prose note's
          // prose to the glossary, would be noise.
          const slug: FullSlug | undefined = file.data.slug
          if (!slug || !slug.startsWith("ilahiler/") || slug.endsWith("/index")) return

          glossary ??= buildGlossary(ctx.argv.directory, opts.glossaryFile)
          if (glossary.index.size === 0) return

          const glossarySlug = opts.glossaryFile.replace(/\.md$/, "")
          autoLinkTree(tree, glossary, (anchor) => `${glossarySlug}#${anchor}`)
        },
      ]
    },
  }
}
