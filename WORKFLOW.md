# Workflow

Obsidian → live site.

## Repos

| Repo | Visibility | Holds |
|---|---|---|
| `din-vault` | private | poems, `Lugat.md` |
| `din-website` | public | Quartz source + built site |

## Branches

| Branch | Holds | Written by |
|---|---|---|
| `main` | Quartz source | you, rarely |
| `gh-pages` | built site | `publish.sh` |

Pages serves `gh-pages`. Never edit it by hand.

## Symlink

`din-website/content` → `~/Projects/din-vault`. This is why the vault stays private — the build runs locally, GitHub never sees it.

If missing:

```bash
cd ~/Projects/quartz-din
ln -s ~/Projects/din-vault content
```

## Commands

```
any edit to vault:      gitpushdin
update website:         publishdinsite
any edit to the site:   gitpushdinquartz
```

`publishdinsite` is the only one that changes what visitors see. The other two
are backups.

## Daily flow

1. Edit poems in Obsidian.
2. **`gitpushdin`** — backs up the vault.
3. **`publishdinsite`** — updates the website.

Step 3 is what changes the site. Step 2 alone changes nothing visible.

## Preview

```bash
cd ~/Projects/quartz-din
npx quartz build --serve
```

<http://localhost:8080>

## What's published

Set by `ignorePatterns` in `quartz.config.ts`. Held back: `Din meseleleri/`, `magi ve din farki/`, `Efendimiz/`, `ilahi serhleri/`, `Templates/`, `Folder Management (technical)/`, `Attachments/`, `.obsidian/`, `.trash/`, `private/`, `structuring-the-site.md`, `Lugat-variations.md`.

`Lugat.md` is published on purpose — inline links point at it.

To hold something back: add it to `ignorePatterns`, then publish.

## Troubleshooting

**Site shows old content** — run `publishdinsite`.

**Build fails on symlink** — recreate it (above).

**Push rejected** — the Raycast scripts `pull --rebase` first, so this usually self-resolves. Otherwise resolve the conflict by hand.

**404 on Pages** — Settings → Pages must be `gh-pages`, `/ (root)`.

## Files

| File | Purpose |
|---|---|
| `publish.sh` | builds, pushes to `gh-pages` |
| `quartz.config.ts` | site settings, publish list |
| `quartz.layout.ts` | page layout |
| `quartz/plugins/din/` | hymn + glossary logic |
| `quartz/components/din/` | UI components |
