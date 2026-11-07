#!/bin/bash
# test-cpu-budget [--log-only] <suite> go test <args…> — runs a go suite, and a whole run past its line in test-cpu-budget.tsv goes red.
# the line is this mac's: with CI set, or --log-only (x lane commit's go step, since a commit never reds on cost), it only logs.
# whole means go test with only the args below: a filter, a tag or a file runs through with no row, and so does a (cached) run.
# one row a whole run in test-cpu-budget.log, tab-separated: start, 1-min load, suite, user + sys, budget, exit.
set -u
log_only=
if [ "${1-}" = --log-only ]; then
    log_only=1
    shift
fi
if [ $# -lt 2 ]; then
    echo "usage: test-cpu-budget [--log-only] <suite> go test <args…>" >&2
    exit 2
fi
suite=$1
shift
[ -z "${CI:-}" ] || log_only=1

whole=
if [ "$1 ${2-}" = "go test" ]; then
    whole=1
    for arg in "${@:3}"; do
        case $arg in
        -count=1 | -v | -json | . | ./...) ;;
        *) whole= ;;
        esac
    done
fi
[ -n "$whole" ] || exec "$@"

here=$(cd "$(dirname "$0")" && pwd)
scratch=$(mktemp "${TMPDIR:-/tmp}/test-cpu-budget.XXXX")
trap 'rm -f "$scratch" "$scratch.out"' EXIT

ms_of() {
    local minutes=${1%%m*} seconds=${1#*m}
    seconds=${seconds%s}
    seconds=${seconds/,/.}
    ms=$((10#$minutes * 60000 + 10#${seconds%.*} * 1000 + 10#${seconds#*.}))
}

# bash's own count of its waited-for children, no spawn; a $(times) would read a fresh subshell's zeros
children_ms() {
    local user sys
    times >"$scratch"
    {
        read -r _
        read -r user sys
    } <"$scratch"
    ms_of "$user"
    local user_ms=$ms
    ms_of "$sys"
    children=$((user_ms + ms))
}

children_ms
before=$children
"$@" | tee "$scratch.out"
code=${PIPESTATUS[0]}
children_ms
used_ms=$((children - before))

if grep -Eq '(^|")ok .*\(cached\)' "$scratch.out"; then
    exit "$code"
fi

budget=-
if [ -r "$here/test-cpu-budget.tsv" ]; then
    # a last row with no newline still counts
    while IFS=$'\t' read -r name line _ || [ -n "$name" ]; do
        [ "$name" = "$suite" ] && budget=$line
    done <"$here/test-cpu-budget.tsv"
fi

case $budget in
- | *[!0-9]* | '') ;;
*) red_past=$((budget * 1000)) ;;
esac
[ -n "${red_past:-}" ] || [ "$budget" = - ] || echo "test-cpu-budget: the $suite row reads '$budget', a whole number of cpu-s; no red on this run" >&2

used=$((used_ms / 1000)).$((used_ms % 1000 / 100))
state=${X_STATE:-$HOME/.local/state/x}
mkdir -p "$state"
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%FT%T%z)" "$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')" "$suite" "$used" "$budget" "$code" >>"$state/test-cpu-budget.log"

if [ "$code" -eq 0 ] && [ -z "$log_only" ] && [ -n "${red_past:-}" ] && [ "$used_ms" -gt "$red_past" ]; then
    cat >&2 <<EOF
test-cpu-budget: $suite used $used cpu-s, its budget is $budget cpu-s.
read what grew first; a later lane may read a cost it did not add, since a related run never counts.
to raise it on purpose: its one row in script/test-cpu-budget.tsv, with the date and the reason.
EOF
    exit 1
fi
exit "$code"
