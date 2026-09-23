/**
 * Text-size control.
 *
 * Everything in the stylesheet is `rem`-based, so setting the root font size
 * scales the whole interface. Steps are absolute px so the result is
 * predictable regardless of the visitor's browser default.
 *
 * Runs in `beforeDOMLoaded` (i.e. from prescript.js in <head>) so the saved
 * size is applied before the first paint.
 */

const STEPS = [17, 19, 21.5, 24, 27]
const DEFAULT_STEP = 1
const STORAGE_KEY = "din-textsize"

function clampStep(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STEP
  return Math.min(STEPS.length - 1, Math.max(0, Math.round(value)))
}

function readStep(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? DEFAULT_STEP : clampStep(Number.parseInt(raw, 10))
  } catch {
    return DEFAULT_STEP
  }
}

function applyStep(step: number) {
  // Leave no inline style at the default so the stylesheet stays in charge.
  if (step === DEFAULT_STEP) {
    document.documentElement.style.removeProperty("font-size")
  } else {
    document.documentElement.style.fontSize = `${STEPS[step]}px`
  }
  document.documentElement.setAttribute("data-textsize", String(step))
}

let step = readStep()
applyStep(step)

document.addEventListener("nav", () => {
  const change = (delta: number) => {
    const next = clampStep(step + delta)
    if (next === step) return
    step = next
    applyStep(step)
    try {
      localStorage.setItem(STORAGE_KEY, String(step))
    } catch {
      /* private mode — size just won't persist */
    }
  }

  for (const button of document.querySelectorAll<HTMLElement>(".textsize-btn")) {
    const onClick = () => change(button.dataset.textsize === "up" ? 1 : -1)
    button.addEventListener("click", onClick)
    window.addCleanup(() => button.removeEventListener("click", onClick))
  }

  // Re-assert: SPA navigation replaces <body>, not <html>, but a full page
  // load re-runs this module and reads the stored value again.
  applyStep(step)
})
