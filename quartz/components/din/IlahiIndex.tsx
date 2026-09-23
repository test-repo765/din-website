import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FullSlug, resolveRelative } from "../../util/path"
import { collectHymns, groupHymns } from "./hymns"
import { TURKISH_ALPHABET, letterAnchor } from "./turkish"

/**
 * The A–Z index. Rendered above the default folder listing on /ilahiler/
 * (the folder listing itself is hidden by CSS, see styles/custom.scss).
 *
 * Why not just use Quartz's built-in folder listing: it sorts by filesystem
 * mtime and prints a date next to every hymn, neither of which means anything
 * to someone looking for a hymn they half-remember.
 */
const IlahiIndex: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const hymns = collectHymns(allFiles)
  const groups = groupHymns(hymns)
  const present = new Set(groups.map((g) => g.letter))

  return (
    <section class="az-index-wrap">
      <nav class="az-jump" aria-label="Harfe göre atla">
        <ul class="letter-grid letter-grid-compact">
          {TURKISH_ALPHABET.map((letter) => {
            const anchor = letterAnchor(letter)
            const hasHymns = present.has(letter)
            return (
              <li>
                {hasHymns ? (
                  <a class="letter-tile" href={`#${anchor}`}>
                    {letter}
                  </a>
                ) : (
                  <span class="letter-tile is-empty" aria-hidden="true">
                    {letter}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <ol class="az-index">
        {groups.map((group) => (
          <li class="az-group" id={letterAnchor(group.letter)}>
            <h2 class="az-letter">
              {group.letter}
              <span class="az-letter-count">{group.hymns.length}</span>
            </h2>
            <ul class="az-list">
              {group.hymns.map((hymn) => (
                <li>
                  <a
                    class="internal az-link"
                    href={resolveRelative(fileData.slug! as FullSlug, hymn.slug as FullSlug)}
                  >
                    {hymn.title}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default (() => IlahiIndex) satisfies QuartzComponentConstructor
