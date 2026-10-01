import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
// Project-local transformer: tab-column layout and (Yazan: …) / (Makam: …)
// captions. See quartz/plugins/din/hymns.ts.
import { DinHymns } from "./quartz/plugins/din/hymns"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "İlahiler",
    // Appended to every <title>: browser tabs, bookmarks and search results all
    // read "<ilahi adı> – İlahiler".
    pageTitleSuffix: " – İlahiler",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "tr-TR",
    // Placeholder until the site has a real home. For a GitHub Pages project site
    // this is "<user>.github.io/<repo>" — no protocol, no trailing slash.
    baseUrl: "test-repo765.github.io/din-website",
    // Only the hymns are published for now. Everything below is held back —
    // most importantly the personal/diary material in "Din meseleleri".
    // NOTE: these are case-sensitive minimatch/globby patterns.
    ignorePatterns: [
      "private/**",
      ".obsidian/**",
      ".trash/**",
      "Templates/**",
      // NB: globby/minimatch would read the literal parentheses in the real
      // folder name as an extglob group, so match the parent with a wildcard.
      "Folder Management*/**",
      "Din meseleleri/**",
      "ilahi serhleri/**",
      "Efendimiz/**",
      "magi ve din farki/**",
      "Attachments/**",
      "Sohbetlerdeki ilahiler.md",
      "note template and other things.md",
      "Lugat-variations.md",
      // Working notes about the site itself — not for readers.
      "structuring-the-site.md",
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        // UI + headings: sans.
        header: "Source Sans 3",
        // Reading surface (the hymns themselves): serif, built for long-form reading.
        body: "Source Serif 4",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#fdfbf5",
          lightgray: "#e7e0d2",
          gray: "#6f6a60",
          darkgray: "#2a2722",
          dark: "#141210",
          secondary: "#1f6b5e",
          tertiary: "#b8860b",
          highlight: "rgba(31, 107, 94, 0.10)",
          textHighlight: "#ffe06688",
        },
        darkMode: {
          light: "#14161a",
          lightgray: "#2e3238",
          gray: "#9aa0a6",
          darkgray: "#e6e3dc",
          dark: "#fbf9f4",
          secondary: "#6fc7b4",
          tertiary: "#e0b341",
          highlight: "rgba(111, 199, 180, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      // The vault runs with Obsidian's "strict line breaks" on, so a single
      // newline IS a line break. Without this every hymn collapses into a
      // run-on paragraph. This is the single most important line in the file.
      Plugin.HardLineBreaks(),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      // Runs first so tabs and indented attribution lines are normalised on the
      // raw text, before OFM starts interpreting wikilinks and callouts.
      // (OFM also strips %%…%% comments; the per-hymn glossary inside those is
      // meant to stay off the page, so nothing here touches it.)
      DinHymns(),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage({
        // Alphabetical by Turkish collation, not by filesystem mtime.
        sort: (a, b) =>
          (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? "", "tr"),
      }),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
