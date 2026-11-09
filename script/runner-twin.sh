#!/bin/bash
# vitest as the ubuntu runner sees the repo: a clean clone (no git-crypt key, so ciphertext),
# an empty HOME and CI=1. a test that reads dima's mac goes red here, before the push.
# node_modules are symlinked from the main checkout, so no install runs.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
sha=${1:-}
step_ref=
remote_sha=
# shellcheck source=script/lib/memory-only.sh
. "$(dirname "$0")/lib/memory-only.sh"
state=${X_STATE:-$HOME/.local/state/x}
# a pre-push hook names what it pushes on stdin, one line a ref: a worktree's push runs from the main checkout, whose HEAD is another commit.
# only a push to main runs the twin: a branch's pr ci reads it before its merge. a main push of only pocket, memory or .md skips too;
# ci's whole suite reads it on main. a hand run (no ref named), a zero remote sha or a failed diff runs it
named=
pushed_main=
carries_code=
if [ -z "$sha" ] && [ ! -t 0 ]; then
    # git's order: local ref, local sha, remote ref, remote sha; `x lane push` pushes a sha, so the local ref is that sha
    while read -r -t 1 _ pushed ref remote; do
        [ -n "$ref" ] || continue
        named=1
        step_ref=${step_ref:-$ref}
        [ "$ref" = refs/heads/main ] || continue
        pushed_main=1 sha=$pushed step_ref=$ref remote_sha=$remote
        case $pushed in *[!0]*) ;; *) continue ;; esac
        # a zero remote sha (nothing to compare) fails the diff, and a failed diff runs the twin
        # --no-renames: code moved to a .md shows its deleted end too, and runs the twin
        paths=$(git -c core.quotePath=false diff --no-renames --name-only "$remote" "$pushed" 2>/dev/null) || {
            carries_code=1
            continue
        }
        while IFS= read -r path; do
            case $path in '' | _clio/pocket/* | *.md) continue ;; esac
            is_memory_path "$path" || carries_code=1
        done <<<"$paths"
    done
fi
sha=${sha:-HEAD}
if [ -n "$named" ] && [ -z "$carries_code" ]; then
    if [ -n "$pushed_main" ]; then
        echo 'runner-twin: skipped, a main push of only pocket, memory or .md; ci runs the suite'
    else
        echo 'runner-twin: skipped, no pushed ref is main; its pr ci runs the suite'
    fi
    if [ -z "${VITEST:-}" ]; then
        mkdir -p "$state"
        printf '%s\t%s\tpush\t%s\t-\t0\t0\ttest:twin:skipped\t-\t%s\n' "$(date +%FT%T%z)" "$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')" "$step_ref" "${remote_sha:--}" >>"$state/gate-steps.log"
    fi
    exit 0
fi
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
# one row in gate-steps.log, read by docs/test-drive/gate-speed.md: a red here on a commit whose test step was related is what the trial counts.
# its 9th column is the cpu one (a dash here), its 10th the remote sha, for a replay
if [ -z "${VITEST:-}" ]; then
    mkdir -p "$state"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\ttest:twin\t-\t%s\n' "$step_start" "$step_load" "$([ -n "$step_ref" ] && echo push || echo other)" "${step_ref:-unnamed}" "$(git rev-parse --short HEAD)" "$SECONDS" "$step_code" "${remote_sha:--}" >>"$state/gate-steps.log"
fi
exit "$step_code"
