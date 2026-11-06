#!/bin/bash
# test-commit <whole-suite command…> — the commit gate's test step, run inside script/index-run.sh's copy.
# a codie/* branch runs only the tests importing its staged code: the whole suite stays at push and on ci. any other branch runs the command.
# one row a run in test-commit.log, tab-separated: start, 1-min load, branch, mode, staged paths, commit it sits on, seconds, exit.
set -u
branch=${INDEX_RUN_BRANCH:-}
state=${X_STATE:-$HOME/.local/state/x}
mkdir -p "$state"
start=$(date +%FT%T%z)
load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')

mode=whole
code_paths=()
staged=0
case $branch in
codie/*)
    mode=related
    # a failed read runs the whole suite, never none
    changes=$(git -c core.quotePath=false diff --cached --name-status -M) || mode=whole
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

code=0
case $mode in
whole) "$@" || code=$? ;;
related) pnpm exec vitest related --run --passWithNoTests "${code_paths[@]}" || code=$? ;;
esac
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "$branch" "$mode" "$staged" "$(git rev-parse --short HEAD)" "$SECONDS" "$code" >>"$state/test-commit.log"
exit "$code"
