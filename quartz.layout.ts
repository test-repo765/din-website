import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
// Project-local components live in their own folder so they never collide with
// upstream Quartz files. See quartz/components/din/.
import * as Din from "./quartz/components/din"

const isHome = (page: any) => page.fileData.slug === "index"
const isHymn = (page: any) => Din.isHymnSlug(page.fileData.slug)
const isHymnIndex = (page: any) => page.fileData.slug === "ilahiler/index"
const notHome = (page: any) => !isHome(page)

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  // `header` renders outside the .popover-hint wrapper (and `afterBody` is
  // outside the article), so neither the home hero nor the prev/next links leak
  // into link-hover popovers. They live here rather than in a PageLayout because
  // PageLayout only accepts beforeBody/left/right — putting them there happens to
  // work via object spread but is not part of the type.
  header: [
    Component.ConditionalRender({
      component: Din.HomeHero(),
      condition: isHome,
    }),
    Component.ConditionalRender({
      component: Din.HymnNav(),
      condition: isHymn,
    }),
  ],
  afterBody: [
    Component.ConditionalRender({
      component: Din.HymnNav(),
      condition: isHymn,
    }),
  ],
  // No links: the upstream GitHub/Discord links are meaningless here, and an
  // empty <ul> is what Footer renders when given none.
  footer: Component.Footer({ links: {} }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ rootName: "Anasayfa" }),
      condition: notHome,
    }),
    // The home page supplies its own heading.
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: notHome,
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Din.TextSize() },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      title: "İlahiler",
      folderDefaultState: "open",
      folderClickBehavior: "collapse",
      useSavedState: true,
      // Turkish collation, and folder-before-file ordering kept from upstream.
      sortFn: (a: any, b: any) => {
        if (!a.isFolder && !b.isFolder) {
          return a.displayName.localeCompare(b.displayName, "tr", {
            numeric: true,
            sensitivity: "base",
          })
        }
        if (a.isFolder && b.isFolder) {
          return a.displayName.localeCompare(b.displayName, "tr", {
            numeric: true,
            sensitivity: "base",
          })
        }
        return !a.isFolder && b.isFolder ? 1 : -1
      },
    }),
  ],
  // Deliberately empty. The right sidebar used to hold a graph view (this
  // corpus has almost no internal links, so it drew an empty box), a table of
  // contents (the hymns have no headings) and backlinks (always empty).
  right: [],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs({ rootName: "Anasayfa" }),
    Component.ArticleTitle(),
    // The full A–Z index replaces the default folder listing on /ilahiler/.
    Component.ConditionalRender({
      component: Din.IlahiIndex(),
      condition: isHymnIndex,
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Din.TextSize() },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      title: "İlahiler",
      folderDefaultState: "open",
      folderClickBehavior: "collapse",
      useSavedState: true,
      sortFn: (a: any, b: any) => {
        if (!a.isFolder && !b.isFolder) {
          return a.displayName.localeCompare(b.displayName, "tr", {
            numeric: true,
            sensitivity: "base",
          })
        }
        if (a.isFolder && b.isFolder) {
          return a.displayName.localeCompare(b.displayName, "tr", {
            numeric: true,
            sensitivity: "base",
          })
        }
        return !a.isFolder && b.isFolder ? 1 : -1
      },
    }),
  ],
  right: [],
}
