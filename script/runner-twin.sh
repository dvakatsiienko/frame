#!/bin/bash
# vitest as the ubuntu runner sees the repo: a clean clone (no git-crypt key, so ciphertext),
# an empty HOME and CI=1. a test that reads dima's mac goes red here, before the push.
# node_modules are symlinked from the main checkout, so no install runs.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
sha=${1:-HEAD}
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
