#!/bin/bash
# vitest as the ubuntu runner sees the repo: a clean clone (no git-crypt key, so ciphertext),
# an empty HOME and CI=1. a test that reads dima's mac goes red here, before the push.
# node_modules are symlinked from the main checkout, so no install runs.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
sha=${1:-}
step_ref=
# a pre-push hook names what it pushes on stdin: a worktree's push runs from the main checkout, whose HEAD is another commit
if [ -z "$sha" ] && [ ! -t 0 ]; then
    # git's order: local ref, local sha, remote ref, remote sha; `x lane push` pushes a sha, so the local ref is that sha
    while read -r -t 1 _ pushed ref _; do
        case $pushed in *[!0]*) sha=$pushed step_ref=$ref ;; esac
    done
fi
sha=${sha:-HEAD}
# a hook may export GIT_DIR and friends: a fixture's git, or this clone's, must never write the real repo, as in index-run.sh
# shellcheck disable=SC2046
unset $(git rev-parse --local-env-vars)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/runner-twin.XXXXXX")
home=$(mktemp -d "${TMPDIR:-/tmp}/runner-twin-home.XXXXXX")
# go's module cache in the fake home is read-only, and rm needs its dirs writable
trap 'chmod -R u+w "$home"; rm -rf "$tmp" "$home"' EXIT

git clone -q --no-local --no-checkout "$repo" "$tmp/frame"
git -C "$tmp/frame" checkout -q "$(git -C "$repo" rev-parse "$sha")"
for dir in . $(sed -n 's/^  - //p' "$repo/pnpm-workspace.yaml"); do
    [ -d "$repo/$dir/node_modules" ] && ln -s "$repo/$dir/node_modules" "$tmp/frame/$dir/node_modules"
done

cd "$tmp/frame"
step_start=$(date +%FT%T%z)
step_load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')
step_code=0
env HOME="$home" CI=1 PATH="$PATH" "$repo/node_modules/.bin/vitest" run --reporter=dot || step_code=$?
# one row in gate-steps.log, read by docs/test-drive/gate-speed.md: a red here on a commit whose test step was related is what the trial counts
if [ -z "${VITEST:-}" ]; then
    step_state=${X_STATE:-$HOME/.local/state/x}
    mkdir -p "$step_state"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\ttest:twin\n' "$step_start" "$step_load" "$([ -n "$step_ref" ] && echo push || echo other)" "${step_ref:-unnamed}" "$(git rev-parse --short HEAD)" "$SECONDS" "$step_code" >>"$step_state/gate-steps.log"
fi
exit "$step_code"
