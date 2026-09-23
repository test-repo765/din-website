import { computePosition, flip, inline, shift } from "@floating-ui/dom"
import { normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

const p = new DOMParser()
let activeAnchor: HTMLAnchorElement | null = null

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = (activeAnchor = this)
  if (link.dataset.noPopover === "true") {
    return
  }

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    Object.assign(popoverElement.style, {
      transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
    })
  }

  function showPopover(popoverElement: HTMLElement) {
    clearActivePopover()
    popoverElement.classList.add("active-popover")
    setPosition(popoverElement as HTMLElement)

    const popoverInnerEl = popoverElement.querySelector(".popover-inner") as HTMLElement | null
    if (!popoverInnerEl) return

    if (hash !== "") {
      const targetId = hash.slice(1) // strip the leading #
      const targetAnchor = `#popover-internal-${targetId}`
      const heading = popoverInnerEl.querySelector(targetAnchor) as HTMLElement | null
      if (heading) {
        // leave ~12px of buffer when scrolling to a heading
        popoverInnerEl.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
      }
    }
  }

  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  targetUrl.hash = ""
  targetUrl.search = ""
  const popoverId = `popover-${link.pathname}${hash ? hash : ""}`
  const prevPopoverElement = document.getElementById(popoverId)

  // dont refetch if there's already a popover
  if (!!document.getElementById(popoverId)) {
    showPopover(prevPopoverElement as HTMLElement)
    return
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err)
  })

  if (!response) return
  const [contentType] = response.headers.get("Content-Type")!.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.id = popoverId
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverInner.dataset.contentType = contentType ?? undefined
  popoverElement.appendChild(popoverInner)

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`
        el.id = targetID
      })
      const elts = [...html.getElementsByClassName("popover-hint")]
      if (elts.length === 0) return

      // If linking to a block reference, isolate that block in the popover
      if (hash !== "") {
        const targetId = hash.slice(1) // strip the leading #
        const targetAnchor = `popover-internal-${targetId}`
        // Try to find the referenced element
        for (const elt of elts) {
          const targetEl = elt.querySelector(`#${targetAnchor}`) as HTMLElement | null
          if (targetEl) {
            // Found the block — show only it (plus its parent heading if it's a paragraph)
            const isolated = document.createElement("div")
            isolated.classList.add("popover-hint")
            // If the target is a paragraph (block ref), show just that paragraph
            // If it's a heading, show the heading and its following content
            if (targetEl.tagName === "H1" || targetEl.tagName === "H2" || targetEl.tagName === "H3" ||
                targetEl.tagName === "H4" || targetEl.tagName === "H5" || targetEl.tagName === "H6") {
              // It's a heading — show the heading and following siblings until the next heading
              isolated.appendChild(targetEl.cloneNode(true))
              let next = targetEl.nextElementSibling
              while (next && !next.tagName.match(/^H[1-6]$/)) {
                isolated.appendChild(next.cloneNode(true))
                next = next.nextElementSibling
              }
            } else {
              // It's a block (paragraph, etc.) — show just that element
              isolated.appendChild(targetEl.cloneNode(true))
            }
            popoverInner.appendChild(isolated)
            document.body.appendChild(popoverElement)
            if (activeAnchor !== this) return
            showPopover(popoverElement)
            return
          }
        }
      }

      // No block reference or block not found — show the whole page
      elts.forEach((elt) => popoverInner.appendChild(elt))
  }

  if (!!document.getElementById(popoverId)) {
    return
  }

  document.body.appendChild(popoverElement)
  if (activeAnchor !== this) {
    return
  }

  showPopover(popoverElement)
}

function clearActivePopover() {
  activeAnchor = null
  const allPopoverElements = document.querySelectorAll(".popover")
  allPopoverElements.forEach((popoverElement) => popoverElement.classList.remove("active-popover"))
}

/** Touch devices have no hover, so the popover is opened by tapping instead. */
const isTouchPrimary = () => window.matchMedia("(hover: none)").matches

/**
 * The link whose popover was opened by a tap. The first tap on a
 * [[Lugat#term]] link shows the definition; tapping the same link again lets
 * the navigation through, so the full glossary page is still reachable.
 */
let shownByTouch: HTMLAnchorElement | null = null

document.addEventListener("nav", () => {
  shownByTouch = null
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]

  for (const link of links) {
    // Hover (mouse / trackpad): upstream behaviour, unchanged.
    const onMouseEnter = (event: MouseEvent) => {
      if (isTouchPrimary()) return
      void mouseEnterHandler.call(link, event)
    }
    const onMouseLeave = () => clearActivePopover()

    /**
     * Tap (phone / tablet). Only links that point at a specific heading or
     * block open a popover — those are the [[Lugat#term]] glossary links.
     * Everything else, including the hymn-to-hymn links and every navigation
     * link, has no fragment and keeps navigating on the first tap.
     */
    const onClick = (event: MouseEvent) => {
      if (!isTouchPrimary() || event.defaultPrevented) return
      if (link.hash === "" || link.dataset.noPopover === "true") return
      if (shownByTouch === link) {
        shownByTouch = null
        return // second tap: let the router navigate
      }
      event.preventDefault()
      shownByTouch = link
      void mouseEnterHandler.call(link, { clientX: event.clientX, clientY: event.clientY })
    }

    link.addEventListener("mouseenter", onMouseEnter)
    link.addEventListener("mouseleave", onMouseLeave)
    link.addEventListener("click", onClick)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", onMouseEnter)
      link.removeEventListener("mouseleave", onMouseLeave)
      link.removeEventListener("click", onClick)
    })
  }

  // Tapping anywhere else dismisses the card, so it never lingers on a phone.
  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (target?.closest(".popover") || target?.closest("a.internal")) return
    shownByTouch = null
    clearActivePopover()
  }
  document.addEventListener("click", onDocumentClick)
  window.addCleanup(() => document.removeEventListener("click", onDocumentClick))
})
