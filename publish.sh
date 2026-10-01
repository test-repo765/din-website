#!/usr/bin/env bash
#
# Build the site locally and publish it to the gh-pages branch.
#
# The vault (din-vault) stays private: this script runs on your Mac, where the
# `content` symlink resolves, and only the built HTML ever reaches GitHub.
#
# Usage:  ./publish.sh ["optional commit message"]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE="$REPO_DIR/.gh-pages-worktree"
BRANCH="gh-pages"
REMOTE="origin"

cd "$REPO_DIR"

msg="${1:-Publish site $(date '+%Y-%m-%d %H:%M')}"

echo "==> Checking the content symlink"
if [[ ! -e content ]]; then
  echo "ERROR: 'content' symlink is missing or dangling." >&2
  echo "       Recreate it with:" >&2
  echo "         ln -s /Users/ege_1/Projects/din-vault content" >&2
  exit 1
fi
echo "    content -> $(readlink content)"

echo "==> Building"
npx quartz build

if [[ ! -f public/index.html ]]; then
  echo "ERROR: build produced no public/index.html" >&2
  exit 1
fi

echo "==> Preparing the $BRANCH worktree"
if [[ -d "$WORKTREE" ]]; then
  git worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add "$WORKTREE" "$BRANCH"
elif git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  git fetch "$REMOTE" "$BRANCH"
  git worktree add "$WORKTREE" -b "$BRANCH" "$REMOTE/$BRANCH"
else
  echo "    creating orphan branch $BRANCH"
  git worktree add --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan "$BRANCH"
  git -C "$WORKTREE" rm -rf --cached . >/dev/null 2>&1 || true
fi

echo "==> Syncing build output into the worktree"
# Clear everything except .git, then copy the fresh build in.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R "$REPO_DIR/public/." "$WORKTREE/"

# GitHub Pages must not run Jekyll over the output.
touch "$WORKTREE/.nojekyll"

echo "==> Committing"
git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "    no changes to publish"
else
  git -C "$WORKTREE" commit -q -m "$msg"
  echo "==> Pushing to $REMOTE/$BRANCH"
  git -C "$WORKTREE" push "$REMOTE" "$BRANCH"
fi

echo "==> Cleaning up"
git worktree remove --force "$WORKTREE"

echo
echo "Done. The site will update at:"
echo "  https://test-repo765.github.io/din-website/"
