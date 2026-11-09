#!/bin/bash
# test-commit <whole-suite command…> — the commit gate's test step, run inside script/index-run.sh's copy.
# a commit whose every staged path sits under _clio/pocket/ runs no suite, on any branch: the whole suite stays at push.
# a commit of only memory runs only the tests that read memory, on any branch (script/lib/memory-only.sh); ci keeps the whole suite.
# every branch runs only the tests importing its staged code; a path off the no-test list, a delete, a rename or a detached HEAD runs the command.
# the whole suite stays at push (the twin) and on ci.
# one row a run in test-commit.log, tab-separated: start, 1-min load, branch, mode, staged paths, commit it sits on, seconds, exit, source.
set -u
# shellcheck source=script/lib/memory-only.sh
. "$(dirname "$0")/lib/memory-only.sh"
branch=${INDEX_RUN_BRANCH:-}
state=${X_STATE:-$HOME/.local/state/x}
mkdir -p "$state"
start=$(date +%FT%T%z)
load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')

mode=whole
code_paths=()
staged=0
# a failed read never runs none: whole on every branch
changes=$(git -c core.quotePath=false diff --cached --name-status -M) || read_failed=1
pocket_only=
memory_only=
if [ -n "$changes" ]; then
    pocket_only=1
    memory_only=1
    # a rename names both ends: each must sit under the pocket
    while IFS=$'\t' read -r _ first second; do
        staged=$((staged + 1))
        case $first in _clio/pocket/*) ;; *) pocket_only= ;; esac
        case $second in '' | _clio/pocket/*) ;; *) pocket_only= ;; esac
        is_memory_path "$first" || memory_only=
        [ -z "$second" ] || is_memory_path "$second" || memory_only=
    done <<<"$changes"
fi
case $branch in
'') kind=detached ;;
main) kind=main ;;
codie/*) kind=codie ;;
clio-wing-*) kind=clio-wing ;;
worktree-*) kind=worktree ;;
*) kind=other ;;
esac
# the kill rule's lever: a kind taken off this list runs the whole suite at commit (docs/test-drive/gate-speed.md)
related_kinds=' main codie clio-wing worktree other '
case $related_kinds in *" $kind "*) [ -n "${read_failed:-}" ] || mode=related ;; esac
if [ "$mode" = related ]; then
    while IFS=$'\t' read -r status path; do
        [ -n "$status" ] || continue
        case $status in
        D* | R*) mode=whole ;;
        esac
        case $path in
        # what every test leans on: the import graph cannot name them
        package.json | pnpm-lock.yaml | pnpm-workspace.yaml | vitest.config.ts | tsconfig*.json | lefthook.yaml | script/lib/test-temp-dir.ts) mode=whole ;;
        *.ts | *.tsx | *.js | *.mjs) code_paths+=("$path") ;;
        # the no-test list: no test reads these kinds by path (a grep, 2026-11-09); the pocket runs none on its own too
        *.svg | *.png | *.jpg | *.jpeg | *.gif | *.webp | *.avif | *.ico | *.mp4 | *.mov | _clio/pocket/*) ;;
        *) mode=whole ;;
        esac
    done <<<"$changes"
    [ "$mode" = related ] && [ ${#code_paths[@]} -eq 0 ] && mode=none
fi
if [ -n "$pocket_only" ]; then
    mode=none
elif [ -n "$memory_only" ]; then
    mode=memory
fi

code=0
if [ "$mode" = related ]; then
    out=$(mktemp "${TMPDIR:-/tmp}/test-commit.XXXX")
    pnpm exec vitest related --run --passWithNoTests "${code_paths[@]}" 2>&1 | tee "$out"
    code=${PIPESTATUS[0]}
    # code no test imports may still be one a test spawns by path: the whole suite reads it
    if grep -q 'No affected test files found' "$out"; then
        mode=whole
        code=0
    fi
    rm -f "$out"
fi
case $mode in
whole)
    "$@" || code=$?
    # index-run logs user + sys for a run marked whole; a run nested under vitest is a fixture, and it would mark a related run
    [ -n "${VITEST:-}" ] || [ -z "${INDEX_RUN_WHOLE_MARK:-}" ] || : >"$INDEX_RUN_WHOLE_MARK"
    ;;
memory) pnpm exec vitest run "${MEMORY_TESTS[@]}" || code=$? ;;
esac
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "${branch:-detached}" "$mode" "$staged" "$(git rev-parse --short HEAD)" "$SECONDS" "$code" "${INDEX_RUN_SOURCE:-other}" >>"$state/test-commit.log"
exit "$code"
