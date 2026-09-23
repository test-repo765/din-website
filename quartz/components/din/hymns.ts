import { bucketLetter, turkishCompare } from "./turkish"

export const HYMNS_FOLDER = "ilahiler"

export interface Hymn {
  slug: string
  title: string
}

export interface HymnGroup {
  letter: string
  hymns: Hymn[]
}

/** True for a hymn note, false for the folder listing and every other page. */
export function isHymnSlug(slug: string | undefined): boolean {
  if (!slug) return false
  return slug.startsWith(`${HYMNS_FOLDER}/`) && !slug.endsWith("/index")
}

/**
 * Every hymn in the vault, alphabetised by Turkish collation.
 *
 * Titles come from the filename stem (the FrontMatter transformer fills in
 * `title` from `file.stem` when a note has no frontmatter, which is true for
 * all of them today).
 */
export function collectHymns(allFiles: readonly any[]): Hymn[] {
  return allFiles
    .filter((f) => isHymnSlug(f?.slug))
    .map((f) => ({
      slug: f.slug as string,
      title: ((f.frontmatter?.title as string) ?? f.slug) as string,
    }))
    .sort((a, b) => turkishCompare(a.title, b.title))
}

/** Group hymns under their index letter, in Turkish alphabet order. */
export function groupHymns(hymns: readonly Hymn[]): HymnGroup[] {
  const byLetter = new Map<string, Hymn[]>()
  for (const hymn of hymns) {
    const letter = bucketLetter(hymn.title)
    const bucket = byLetter.get(letter)
    if (bucket) {
      bucket.push(hymn)
    } else {
      byLetter.set(letter, [hymn])
    }
  }

  return [...byLetter.entries()]
    .map(([letter, group]) => ({ letter, hymns: group }))
    .sort((a, b) => turkishCompare(a.letter, b.letter))
}
