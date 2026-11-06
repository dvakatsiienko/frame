#!/bin/bash
# gate-queue [--long] <command…> — one heavy run at a time per slot on this mac: a commit or push gate in the default slot;
# a long round (mutants, a red-proof round, a whole suite by hand) with --long, so a commit never waits behind one.
# it waits for the machine-wide turn, runs the command, and hands back its exit code; 75 means the wait passed its deadline.
# a turn is a mkdir, atomic on any disk, holding the holder's pid and start time, so a dead holder or a reused pid frees it.
# waiters line up first come, first served: one ticket file each, named <epoch>.<pid>, so a newcomer never jumps a waiter.
set -u
slot=gate
if [ "${1-}" = --long ]; then
    slot=long
    shift
fi
if [ $# -eq 0 ]; then
    echo "usage: gate-queue [--long] <command…>" >&2
    exit 2
fi
# a queued run calling another queued run keeps its turn
if [ -n "${GATE_QUEUE_HELD:-}" ]; then exec "$@"; fi

state=${X_STATE:-$HOME/.local/state/x}
turn=$state/gate-queue.turn
[ "$slot" = long ] && turn=$state/gate-queue.long.turn
tickets=$turn.tickets
log=$state/gate-queue.log
wait_max=${GATE_QUEUE_WAIT:-1500}
mkdir -p "$tickets"

# one space between words: ps pads this field, and the holder file's read would trim it
one_line() { echo $*; }
started_at() { one_line "$(ps -o lstart= -p "$1" 2>/dev/null)"; }

# a turn is stale when its holder is gone; a turn just taken has no holder file yet, so it gets 10 s
is_stale() {
    local pid since
    if ! { read -r pid && read -r since; } 2>/dev/null <"$turn/holder"; then
        [ -n "$(find "$turn" -maxdepth 0 -mmin +0.17 2>/dev/null)" ]
        return
    fi
    [ "$(started_at "$pid")" != "$(one_line "$since")" ]
}

# one row a run, tab-separated: start, 1-min load at the start, slot, wait s, run s (- when it never ran), exit, command
log_run() {
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "$slot" "$waited" "$1" "$2" "$(one_line "$cmd")" >>"$log"
}

# a ticket ahead whose owner is gone leaves the line; true when this run's ticket is the first
first_in_line() {
    local first since
    while first=$(ls "$tickets" | head -n 1); [ -n "$first" ] && [ "$tickets/$first" != "$ticket" ]; do
        since=
        { read -r since; } 2>/dev/null <"$tickets/$first"
        [ "$(started_at "${first##*.}")" = "$(one_line "$since")" ] && return 1
        rm -f "$tickets/$first"
    done
}

cmd=$*
start=$(date +%FT%T%z)
load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')
began=$(date +%s)
ticket=$tickets/$began.$$
started_at $$ >"$tickets/.new.$$"
mv "$tickets/.new.$$" "$ticket"
leave() { rm -f "$ticket"; }
trap leave EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
waited=0
next_say=0
until first_in_line && mkdir "$turn" 2>/dev/null; do
    if is_stale; then
        # the rename is atomic: of two waiters seeing one stale turn, only one frees it
        if mv "$turn" "$turn.stale.$$" 2>/dev/null; then
            echo "gate-queue: freed a dead holder's turn" >&2
            rm -rf "$turn.stale.$$"
        fi
        continue
    fi
    if [ "$waited" -ge "$wait_max" ]; then
        echo "gate-queue: waited ${waited}s, deadline passed, nothing ran. holder: $(tail -n 1 "$turn/holder" 2>/dev/null)" >&2
        log_run - 75
        exit 75
    fi
    if [ "$waited" -ge "$next_say" ]; then
        echo "gate-queue: waiting ${waited}s, holder: $(tail -n 1 "$turn/holder" 2>/dev/null)" >&2
        next_say=$((next_say + 30))
    fi
    sleep 2
    waited=$(($(date +%s) - began))
done

took=$(date +%s)
release() {
    local code=$?
    rm -rf "$turn"
    log_run "$(($(date +%s) - took))" "$code"
}
leave
trap release EXIT
printf '%s\n%s\n%s\n' "$$" "$(started_at $$)" "$*" >"$turn/holder"
[ "$waited" -gt 0 ] && echo "gate-queue: took the turn after ${waited}s" >&2
GATE_QUEUE_HELD=1 "$@"
