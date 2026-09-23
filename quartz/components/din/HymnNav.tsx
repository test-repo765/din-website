import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FullSlug, resolveRelative } from "../../util/path"
import { collectHymns, isHymnSlug } from "./hymns"

/**
 * Previous / next hymn, walking the same Turkish alphabetical order used by
 * the A–Z index. Rendered above and below the hymn so nobody has to scroll
 * back to the top, and so a reader can work through the collection in order.
 */
const HymnNav: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug
  if (!isHymnSlug(slug)) return null

  const hymns = collectHymns(allFiles)
  const index = hymns.findIndex((h) => h.slug === slug)
  if (index === -1) return null

  const previous = index > 0 ? hymns[index - 1] : undefined
  const next = index < hymns.length - 1 ? hymns[index + 1] : undefined

  const link = (hymn: typeof previous, direction: "prev" | "next") => {
    if (!hymn) {
      return (
        <span class={`hymn-step hymn-step-${direction} is-disabled`} aria-hidden="true">
          <span class="hymn-step-label">{direction === "prev" ? "‹ Önceki" : "Sonraki ›"}</span>
          <span class="hymn-step-title">&nbsp;</span>
        </span>
      )
    }
    return (
      <a
        class={`hymn-step hymn-step-${direction} internal`}
        href={resolveRelative(slug as FullSlug, hymn.slug as FullSlug)}
        rel={direction === "prev" ? "prev" : "next"}
      >
        <span class="hymn-step-label">{direction === "prev" ? "‹ Önceki" : "Sonraki ›"}</span>
        <span class="hymn-step-title">{hymn.title}</span>
      </a>
    )
  }

  return (
    <nav class={`hymn-nav ${displayClass ?? ""}`} aria-label="İlahiler arasında gezinme">
      {link(previous, "prev")}
      {link(next, "next")}
    </nav>
  )
}

export default (() => HymnNav) satisfies QuartzComponentConstructor
