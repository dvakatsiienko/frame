#!/bin/bash
# test-commit <whole-suite command…> — the commit gate's test step, run inside script/index-run.sh's copy.
# a commit whose every staged path sits under _clio/pocket/ runs no suite, on any branch: the whole suite stays at push.
# a codie/* branch runs only the tests importing its staged code: the whole suite stays at push and on ci. any other branch runs the command.
# one row a run in test-commit.log, tab-separated: start, 1-min load, branch, mode, staged paths, commit it sits on, seconds, exit, source.
set -u
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
if [ -n "$changes" ]; then
    pocket_only=1
    pocket_paths=0
    # a rename names both ends: each must sit under the pocket
    while IFS=$'\t' read -r _ first second; do
        pocket_paths=$((pocket_paths + 1))
        case $first in _clio/pocket/*) ;; *) pocket_only= ;; esac
        case $second in '' | _clio/pocket/*) ;; *) pocket_only= ;; esac
    done <<<"$changes"
fi
case $branch in
codie/*)
    mode=related
    [ -z "${read_failed:-}" ] || mode=whole
    while IFS=$'\t' read -r status path; do
        [ -n "$status" ] || continue
        staged=$((staged + 1))
        case $status in
        D* | R*) mode=whole ;;
        esac
        # what every test leans on: the import graph cannot name them
        case $path in
        package.json | pnpm-lock.yaml | pnpm-workspace.yaml | vitest.config.ts | tsconfig*.json | lefthook.yaml | script/lib/test-temp-dir.ts) mode=whole ;;
        *.ts | *.tsx | *.js | *.mjs) code_paths+=("$path") ;;
        esac
    done <<<"$changes"
    [ "$mode" = related ] && [ ${#code_paths[@]} -eq 0 ] && mode=none
    ;;
esac
if [ -n "$pocket_only" ]; then
    mode=none
    staged=$pocket_paths
fi

code=0
case $mode in
whole) "$@" || code=$? ;;
related) pnpm exec vitest related --run --passWithNoTests "${code_paths[@]}" || code=$? ;;
esac
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "$branch" "$mode" "$staged" "$(git rev-parse --short HEAD)" "$SECONDS" "$code" "${INDEX_RUN_SOURCE:-other}" >>"$state/test-commit.log"
exit "$code"
