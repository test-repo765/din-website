import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { classNames } from "../../util/lang"
// @ts-ignore
import textSizeScript from "./scripts/textsize.inline"

/**
 * Text-size control.
 *
 * The whole stylesheet is expressed in `rem`, so nudging the root font size
 * scales the entire site proportionally — headings, sidebar, search, spacing.
 * `beforeDOMLoaded` so the saved size is applied before first paint (no flash
 * of small text the way Darkmode applies the saved theme).
 */
const TextSize: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={classNames(displayClass, "textsize")} role="group" aria-label="Yazı boyutu">
      <button
        class="textsize-btn"
        type="button"
        data-textsize="down"
        aria-label="Yazıyı küçült"
        title="Yazıyı küçült"
      >
        A−
      </button>
      <button
        class="textsize-btn"
        type="button"
        data-textsize="up"
        aria-label="Yazıyı büyüt"
        title="Yazıyı büyüt"
      >
        A+
      </button>
    </div>
  )
}

TextSize.beforeDOMLoaded = textSizeScript

export default (() => TextSize) satisfies QuartzComponentConstructor
