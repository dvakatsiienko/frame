#!/bin/bash
# test-commit <whole-suite command…> — the commit gate's test step, run inside script/index-run.sh's copy.
# a commit whose every staged path sits under _clio/pocket/ runs no suite, on any branch: the whole suite stays at push.
# a commit of only memory runs only the tests that read memory, on any branch (script/lib/memory-only.sh); ci keeps the whole suite.
# every branch runs only the tests importing its staged code. what the import graph cannot judge (a path off the no-test list,
# a config path, a delete, a rename, code no test imports, a failed read, a detached HEAD) runs none and says so: the whole suite
# stays at push (the twin) and on ci. the one whole run left is a branch kind taken off related_kinds.
# one row a run in test-commit.log, tab-separated: start, 1-min load, branch, mode, staged paths, commit it sits on, seconds, exit,
# source, then from 2026-11-10 the staged paths by kind (code=N,config=N,asset=N,other=N) and the mode the rules before that day ran.
set -u
# shellcheck source=script/lib/memory-only.sh
. "$(dirname "$0")/lib/memory-only.sh"
branch=${INDEX_RUN_BRANCH:-}
state=${X_STATE:-$HOME/.local/state/x}
mkdir -p "$state"
start=$(date +%FT%T%z)
load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')

# was: the mode the rules before 2026-11-10 ran, logged so a replay can price the change
was=whole mode=none
code_paths=()
staged=0
n_code=0 n_config=0 n_asset=0 n_other=0
path_kind() {
    case $1 in
    # what every test leans on: the import graph cannot name them
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | vitest.config.ts | tsconfig*.json | lefthook.yaml | script/lib/test-temp-dir.ts) kind_of=config ;;
    *.ts | *.tsx | *.js | *.mjs) kind_of=code ;;
    # the no-test list: no test reads these kinds by path (a grep, 2026-11-09); the pocket runs none on its own too
    *.svg | *.png | *.jpg | *.jpeg | *.gif | *.webp | *.avif | *.ico | *.mp4 | *.mov | _clio/pocket/*) kind_of=asset ;;
    *) kind_of=other ;;
    esac
}
changes=$(git -c core.quotePath=false diff --cached --name-status -M) || read_failed=1
pocket_only=
memory_only=
if [ -n "$changes" ]; then
    pocket_only=1
    memory_only=1
    # a rename names both ends: each must sit under the pocket
    while IFS=$'\t' read -r _ first second; do
        staged=$((staged + 1))
        path_kind "${second:-$first}"
        case $kind_of in
        code) n_code=$((n_code + 1)) ;;
        config) n_config=$((n_config + 1)) ;;
        asset) n_asset=$((n_asset + 1)) ;;
        *) n_other=$((n_other + 1)) ;;
        esac
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
# the kill rule's lever: a kind taken off this list runs the whole suite at commit, the one whole run left (docs/test-drive/gate-speed.md)
related_kinds=' main codie clio-wing worktree other '
if [ -z "${read_failed:-}" ] && [ "$kind" != detached ]; then
    case $related_kinds in
    *" $kind "*) mode=related was=related ;;
    *) mode=whole ;;
    esac
fi
if [ "$mode" = related ]; then
    while IFS=$'\t' read -r status path; do
        [ -n "$status" ] || continue
        case $status in
        D* | R*) mode=none was=whole ;;
        esac
        path_kind "$path"
        case $kind_of in
        config) mode=none was=whole ;;
        code) code_paths+=("$path") ;;
        asset) ;;
        *) mode=none was=whole ;;
        esac
    done <<<"$changes"
    [ "$mode" = related ] && [ ${#code_paths[@]} -eq 0 ] && mode=none was=none
fi
if [ -n "$pocket_only" ]; then
    mode=none was=none
elif [ -n "$memory_only" ]; then
    mode=memory was=memory
fi

code=0
if [ "$mode" = related ]; then
    out=$(mktemp "${TMPDIR:-/tmp}/test-commit.XXXX")
    pnpm exec vitest related --run --passWithNoTests "${code_paths[@]}" 2>&1 | tee "$out"
    code=${PIPESTATUS[0]}
    # code no test imports may still be one a test spawns by path: the push twin and ci read it
    if grep -q 'No affected test files found' "$out"; then
        mode=none was=whole
        code=0
    fi
    rm -f "$out"
fi
[ "$mode" != none ] || [ "$was" != whole ] || echo 'test-commit: no related tests, the push and ci run the suite'
case $mode in
whole)
    "$@" || code=$?
    # index-run logs user + sys for a run marked whole; a run nested under vitest is a fixture, and it would mark a related run
    [ -n "${VITEST:-}" ] || [ -z "${INDEX_RUN_WHOLE_MARK:-}" ] || : >"$INDEX_RUN_WHOLE_MARK"
    ;;
memory) pnpm exec vitest run "${MEMORY_TESTS[@]}" || code=$? ;;
esac
by_kind=code=$n_code,config=$n_config,asset=$n_asset,other=$n_other
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "${branch:-detached}" "$mode" "$staged" "$(git rev-parse --short HEAD)" "$SECONDS" "$code" "${INDEX_RUN_SOURCE:-other}" "$by_kind" "$was" >>"$state/test-commit.log"
exit "$code"
