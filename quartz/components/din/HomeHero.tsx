import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FullSlug, resolveRelative } from "../../util/path"
import { collectHymns, groupHymns } from "./hymns"
import { TURKISH_ALPHABET, letterAnchor } from "./turkish"
// @ts-ignore
import homeScript from "./scripts/home.inline"

/**
 * Landing page.
 *
 * Deliberately three things and nothing else: one obvious way in (search),
 * one playful way in (a random hymn), and the alphabet for people who would
 * rather browse. No dates, no metadata, no graph.
 */
const HomeHero: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const hymns = collectHymns(allFiles)
  const groups = groupHymns(hymns)
  const present = new Set(groups.map((g) => g.letter))

  const indexHref = resolveRelative(fileData.slug! as FullSlug, "ilahiler/index" as FullSlug)

  return (
    <section class="home">
      <header class="home-hero">
        <p class="home-eyebrow">Hoş geldiniz</p>
        <h1 class="home-title">İlâhîler</h1>
        <p class="home-lede">
          Aradığınız ilahiyi <strong>ilk dizesini</strong> yazarak bulabilirsiniz. İsterseniz
          aşağıdaki harflerden de seçebilirsiniz.
        </p>
        <div class="home-actions">
          <button class="home-search" type="button">
            <span class="home-action-icon" aria-hidden="true">
              🔍
            </span>
            İlahi ara
          </button>
          <button class="home-random" type="button">
            <span class="home-action-icon" aria-hidden="true">
              ✨
            </span>
            Rastgele bir ilahi aç
          </button>
        </div>
        <p class="home-count">
          Toplam <strong>{hymns.length}</strong> ilahi
        </p>
      </header>

      <nav class="home-letters" aria-label="Harfe göre ilahi bul">
        <h2 class="home-section-title">Harfe göre</h2>
        <ul class="letter-grid">
          {TURKISH_ALPHABET.map((letter) => {
            const anchor = letterAnchor(letter)
            const hasHymns = present.has(letter)
            return (
              <li>
                {hasHymns ? (
                  <a class="letter-tile" href={`${indexHref}#${anchor}`}>
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

      <p class="home-browse">
        <a class="home-browse-link" href={indexHref}>
          Bütün ilahileri A–Z listele ({hymns.length})
        </a>
      </p>
    </section>
  )
}

HomeHero.afterDOMLoaded = homeScript

export default (() => HomeHero) satisfies QuartzComponentConstructor
