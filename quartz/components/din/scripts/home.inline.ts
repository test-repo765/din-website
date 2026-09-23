/**
 * Home page helpers: open the site search, and open a random hymn.
 *
 * The random pick reads the content index the page already downloads for
 * search (`fetchData`, declared in renderPage.tsx), so it costs no extra
 * request and no extra markup.
 */
document.addEventListener("nav", async () => {
  for (const button of document.getElementsByClassName("home-search")) {
    const onClick = () => {
      const searchButton = document.querySelector<HTMLElement>(".search-button")
      if (searchButton) {
        searchButton.click()
      } else {
        // Search is not rendered on this layout — fall back to the full index.
        document.querySelector<HTMLAnchorElement>(".home-browse-link")?.click()
      }
    }
    button.addEventListener("click", onClick)
    window.addCleanup(() => button.removeEventListener("click", onClick))
  }

  let hymnSlugs: string[] | undefined

  for (const button of document.getElementsByClassName("home-random")) {
    const onClick = async () => {
      try {
        if (!hymnSlugs) {
          const data: Record<string, unknown> = await (globalThis as any).fetchData
          hymnSlugs = Object.keys(data).filter(
            (slug) => slug.startsWith("ilahiler/") && !slug.endsWith("/index"),
          )
        }
        if (hymnSlugs.length === 0) return
        const slug = hymnSlugs[Math.floor(Math.random() * hymnSlugs.length)]
        // The button only exists on the home page, so resolving against the
        // document base gives the right path under any hosting subpath.
        const url = new URL(slug, document.baseURI)
        if (typeof window.spaNavigate === "function") {
          window.spaNavigate(url)
        } else {
          window.location.href = url.href
        }
      } catch {
        document.querySelector<HTMLAnchorElement>(".home-browse-link")?.click()
      }
    }
    button.addEventListener("click", onClick)
    window.addCleanup(() => button.removeEventListener("click", onClick))
  }
})
