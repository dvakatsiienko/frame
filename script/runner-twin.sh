#!/bin/bash
# vitest as the ubuntu runner sees the repo: a clean clone (no git-crypt key, so ciphertext),
# an empty HOME and CI=1. a test that reads dima's mac goes red here, before the push.
# node_modules are symlinked from the main checkout, so no install runs.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
sha=${1:-}
# a pre-push hook names what it pushes on stdin: a worktree's push runs from the main checkout, whose HEAD is another commit
if [ -z "$sha" ] && [ ! -t 0 ]; then
    while read -r -t 1 _ pushed _ _; do
        case $pushed in *[!0]*) sha=$pushed ;; esac
    done
fi
sha=${sha:-HEAD}
# a hook may export GIT_DIR and friends: a fixture's git, or this clone's, must never write the real repo, as in index-run.sh
# shellcheck disable=SC2046
unset $(git rev-parse --local-env-vars)
tmp=$(mktemp -d)
home=$(mktemp -d)
trap 'trash "$tmp" "$home" 2>/dev/null' EXIT

git clone -q --no-local --no-checkout "$repo" "$tmp/frame"
git -C "$tmp/frame" checkout -q "$(git -C "$repo" rev-parse "$sha")"
for dir in . $(sed -n 's/^  - //p' "$repo/pnpm-workspace.yaml"); do
    [ -d "$repo/$dir/node_modules" ] && ln -s "$repo/$dir/node_modules" "$tmp/frame/$dir/node_modules"
done

cd "$tmp/frame"
env HOME="$home" CI=1 PATH="$PATH" "$repo/node_modules/.bin/vitest" run --reporter=dot
