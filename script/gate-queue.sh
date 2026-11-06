#!/bin/bash
# gate-queue <command…> — one heavy run at a time on this mac: a commit gate, a mutant round, a whole test suite.
# it waits for the machine-wide turn, runs the command, and hands back its exit code; 75 means the wait passed its deadline.
# a turn is a mkdir, atomic on any disk, holding the holder's pid and start time, so a dead holder or a reused pid frees it.
set -u
if [ $# -eq 0 ]; then
    echo "usage: gate-queue <command…>" >&2
    exit 2
fi
# a queued run calling another queued run keeps its turn
if [ -n "${GATE_QUEUE_HELD:-}" ]; then exec "$@"; fi

state=${X_STATE:-$HOME/.local/state/x}
turn=$state/gate-queue.turn
wait_max=${GATE_QUEUE_WAIT:-1500}
mkdir -p "$state"

# one space between words: ps pads this field, and the holder file's read would trim it
one_line() { echo $*; }
started_at() { one_line "$(ps -o lstart= -p "$1" 2>/dev/null)"; }

# a turn is stale when its holder is gone; a turn just taken has no holder file yet, so it gets 10 s
is_stale() {
    local pid since
    if ! { read -r pid && read -r since; } <"$turn/holder" 2>/dev/null; then
        [ -n "$(find "$turn" -maxdepth 0 -mmin +0.17 2>/dev/null)" ]
        return
    fi
    [ "$(started_at "$pid")" != "$(one_line "$since")" ]
}

waited=0
until mkdir "$turn" 2>/dev/null; do
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
        exit 75
    fi
    if [ $((waited % 30)) -eq 0 ]; then
        echo "gate-queue: waiting ${waited}s, holder: $(tail -n 1 "$turn/holder" 2>/dev/null)" >&2
    fi
    sleep 2
    waited=$((waited + 2))
done

release() { rm -rf "$turn"; }
trap release EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '%s\n%s\n%s\n' "$$" "$(started_at $$)" "$*" >"$turn/holder"
[ "$waited" -gt 0 ] && echo "gate-queue: took the turn after ${waited}s" >&2
GATE_QUEUE_HELD=1 "$@"
