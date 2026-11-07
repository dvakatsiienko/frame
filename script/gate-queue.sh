#!/bin/bash
# gate-queue [--long | --hold] <command…> — one heavy run at a time per slot on this mac.
# --long: a long round (mutants, a red-proof round, a whole suite by hand), so a commit never waits behind one.
# --hold <label…>: the gate slot, x's own door: x lane commit and push hold it around their hook. once it has the turn it prints
# one line and holds until its stdin gives an exit code or closes, so a dead x frees the turn; a hung hook frees it at the cap, 600 s, exit 124.
# no flag: no turn, it says so, runs the command and logs slot none; a turn held by a wrapped chain made every commit wait behind it.
# a turn waits for the machine-wide slot and hands back the exit code; 75 means the wait passed its deadline.
# a turn is a mkdir, atomic on any disk, holding the holder's pid and start time, so a dead holder or a reused pid frees it.
# waiters line up first come, first served: one ticket file each, named <epoch>.<pid>, so a newcomer never jumps a waiter.
set -u
slot=none
case ${1-} in
--long)
    slot=long
    shift
    ;;
--hold)
    slot=gate
    shift
    ;;
esac
if [ $# -eq 0 ]; then
    echo "usage: gate-queue [--long] <command…>, or --hold <label…>, x's own door" >&2
    exit 2
fi
held=${GATE_QUEUE_HELD:-}
hold_until_told() {
    local code= cap=${GATE_QUEUE_HOLD_CAP:-600} from=$SECONDS
    echo turn
    read -r -t "$cap" code
    if [ -z "$code" ] && [ $((SECONDS - from)) -ge "$cap" ]; then
        echo "gate-queue: a hold passed its ${cap}s cap, the turn is free and its run goes on: $*" >&2
        exit 124
    fi
    exit "${code:-1}"
}
# a queued run calling another queued run of its slot keeps its turn; a commit inside a long round still takes the gate slot
[ "$slot" = gate ] && [ "$held" = gate ] && hold_until_told "$@"
[ "$slot" = long ] && [ "$held" = long ] && exec "$@"
[ "$slot" = none ] && [ -n "$held" ] && exec "$@"

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

# a turn is stale when its holder is gone; a turn just taken has no holder file yet, so it gets a minute
is_stale() {
    local pid since now
    if [ ! -s "$turn/holder" ]; then
        [ -n "$(find "$turn" -maxdepth 0 -mmin +1 2>/dev/null)" ]
        return
    fi
    { read -r pid && read -r since; } 2>/dev/null <"$turn/holder"
    now=$(started_at "$pid")
    [ -z "$now" ] || [ "$now" != "$(one_line "$since")" ]
}

# one row a run, tab-separated: start, 1-min load at the start, slot, wait s, run s (- when it never ran), exit, session, command
session=${CLAUDE_CODE_SESSION_ID:-}
session=${session:0:8}
log_run() {
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$load" "$slot" "$waited" "$1" "$2" "${session:--}" "$(one_line "$cmd")" >>"$log"
}

# a ticket ahead whose owner is gone leaves the line; true when this run's ticket is the first
first_in_line() {
    local first since now
    while first=$(ls "$tickets" | head -n 1); [ -n "$first" ] && [ "$tickets/$first" != "$ticket" ]; do
        since=
        { read -r since; } 2>/dev/null <"$tickets/$first"
        now=$(started_at "${first##*.}")
        [ -n "$now" ] && [ "$now" = "$(one_line "$since")" ] && return 1
        rm -f "$tickets/$first"
    done
}

cmd=$*
start=$(date +%FT%T%z)
load=$(uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/')
began=$(date +%s)
waited=0
if [ "$slot" = none ]; then
    echo "gate-queue: no turn here: x lane commit and push take their own, a long round takes --long" >&2
    logged() {
        local code=$?
        log_run "$(($(date +%s) - began))" "$code"
    }
    trap logged EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    GATE_QUEUE_HELD=none "$@"
    exit $?
fi
ticket=$tickets/$began.$$
started_at $$ >"$tickets/.new.$$"
mv "$tickets/.new.$$" "$ticket"
leave() { rm -f "$ticket"; }
trap leave EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
next_say=0
until first_in_line && mkdir "$turn" 2>/dev/null; do
    # only the first in line frees a stale turn, so it never takes a turn a newer run just made
    if first_in_line && is_stale; then
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
    sleep "${GATE_QUEUE_POLL:-2}"
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
[ "$slot" = gate ] && hold_until_told "$@"
GATE_QUEUE_HELD=$slot "$@"
