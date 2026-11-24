#!/bin/bash
# gate-queue [--long | --hold | --hold-long] <command…> — one heavy run at a time per slot on this mac.
# --long: a long round (mutants, an x verify red round, a whole suite by hand), so a commit never waits behind one.
# --hold <label…>: the gate slot, x's own door: x lane commit and push hold it around their hook. once it has the turn it prints
# one line and holds until its stdin gives an exit code or closes, so a dead x frees the turn; a hung hook frees it at the cap, 600 s, exit 124.
# --hold-long <label…>: the same door on the long turn, for a batch that gives it back between its groups; its cap is an hour, past
# any one pair.
# no flag: no turn, it says so, runs the command and logs slot none; a turn held by a wrapped chain made every commit wait behind it.
# a mods suite (claude plugin test, mods:test, mods/test.ts anywhere in the command) starts at a 1-minute load of 14 or under, one
# a core: first in line it waits for the load, and past the deadline it runs nothing, exit 75. two suites back to back sat at 35.
# in the long line a whole suite goes ahead of every batch (mutants, red proofs, one file): its ticket sorts first. a mods suite over
# the load lets a batch past only once the turn has stood free 2 min: the load a batch made is gone by then.
# a turn waits for the machine-wide slot and hands back the exit code; 75 means the wait passed its deadline.
# a turn is a mkdir, atomic on any disk, holding the holder's pid and start time, so a dead holder or a reused pid frees it.
# waiters line up first come, first served inside their class: one ticket file each, named <epoch>.<pid>, a suite's 0.<epoch>.<pid>, a mods suite's 0.<epoch>.m.<pid>.
set -u
slot=none
is_hold=
case ${1-} in
--long)
    slot=long
    shift
    ;;
--hold)
    slot=gate
    is_hold=1
    hold_cap=600
    shift
    ;;
--hold-long)
    slot=long
    is_hold=1
    hold_cap=3600
    shift
    ;;
esac
if [ $# -eq 0 ]; then
    echo "usage: gate-queue [--long] <command…>, or --hold or --hold-long <label…>, x's own doors" >&2
    exit 2
fi
held=${GATE_QUEUE_HELD:-}
hold_until_told() {
    local code= cap=${GATE_QUEUE_HOLD_CAP:-$hold_cap} from=$SECONDS
    echo turn
    read -r -t "$cap" code
    if [ -z "$code" ] && [ $((SECONDS - from)) -ge "$cap" ]; then
        echo "gate-queue: a hold passed its ${cap}s cap, the turn is free and its run goes on: $*" >&2
        exit 124
    fi
    exit "${code:-1}"
}
# a queued run calling another queued run of its slot keeps its turn; a commit inside a long round still takes the gate slot
[ -n "$is_hold" ] && [ "$held" = "$slot" ] && hold_until_told "$@"
load_max=14
load_now() { uptime | sed -E 's/.*load averages?: *([0-9.]+).*/\1/'; }
is_mods_suite=
case "$slot$is_hold $*" in "long "*"plugin test"* | "long "*mods:test* | "long "*mods/test.ts*) is_mods_suite=1 ;; esac
# a whole suite: mods, go or a package's own `pnpm test`, read from where the command starts, past its wrappers (time, env, a shell
# line that chains such runs by && alone); a run narrowed to a file or a test, a red round, or any other command is a batch
is_suite=
narrowed='(^| )(--only|--extra|--pairs|-run)([ =]|$)'
wraps='^(([^ ]*/)?(time|timeout|env|nice|test-vm-go[.]sh)( (-[^ ]+|[0-9.]+[smh]?|[A-Z_]+=[^ ]*))* )*(([^ ]*/)?(sh|bash|zsh) -l?c (cd [^ ]+ && )?)?([A-Z_]+=[^ ]* )*'
suites='(([^ ]*/)?claude plugin test [^&]*|pnpm( (-s|--silent|run|-C [^ ]+|--filter[ =][^ ]+))* ((mods:test|x-go:test|x-go:gate)( [^&]*)?|([a-z-]+:)?test( -[^ &]+)*)|(pnpm )?node ([^ &]*/)?mods/test[.]ts( [^&]*)?|go( -C [^ ]+)? test [^&]*[.](/[.][.][.])?)'
chain=' *(&& *(pnpm|claude|go|node) [^&]*)*$'
[ "$slot$is_hold" = long ] && [[ "$*" != *[\;\|]* && "$*" != *$'\n'* && ! "$*" =~ $narrowed && "$*" =~ $wraps$suites$chain ]] && is_suite=1
is_low_load() { awk -v now="$(load_now)" -v max="$load_max" 'BEGIN { exit !(now + 0 <= max + 0) }'; }
is_calm() { [ -z "$is_mods_suite" ] || is_low_load; }
# what a wait waits on
holder() {
    if [ -d "$turn" ]; then
        echo "holder: $(tail -n 1 "$turn/holder" 2>/dev/null)"
    else
        echo "the 1-minute load is $(load_now), a mods suite starts at $load_max or under"
    fi
}
if [ "$slot" = long ] && [ "$held" = long ] && [ -z "$is_hold" ]; then
    began=$(date +%s)
    turn=/nonexistent
    until is_calm; do
        if [ $(($(date +%s) - began)) -ge "${GATE_QUEUE_WAIT:-1500}" ]; then
            echo "gate-queue: waited $(($(date +%s) - began))s, deadline passed, nothing ran. $(holder)" >&2
            exit 75
        fi
        sleep "${GATE_QUEUE_POLL:-2}"
    done
    exec "$@"
fi
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

freed() { date +%s >"$turn.freed"; }
# the turn stood free for the suite of this ticket, 2 min from its arrival or the last release, and the load kept it out
is_load_outside() {
    local born=${1#0.} last=0
    born=${born%%.*}
    { read -r last; } 2>/dev/null <"$turn.freed"
    [ "$born" -gt "${last:-0}" ] && last=$born
    [ $(($(date +%s) - last)) -ge "${GATE_QUEUE_LOAD_GRACE:-120}" ] && ! is_low_load
}

# a ticket ahead whose owner is gone leaves the line; true when this run's ticket is the first, or, asked `past-load`, when only mods
# suites the load keeps out stand ahead of it
first_in_line() {
    local ahead since now
    for ahead in $(ls "$tickets"); do
        [ "$tickets/$ahead" = "$ticket" ] && return 0
        since=
        { read -r since; } 2>/dev/null <"$tickets/$ahead"
        now=$(started_at "${ahead##*.}")
        if [ -n "$now" ] && [ "$now" = "$(one_line "$since")" ]; then
            [ "${1-}" = past-load ] && [[ $ahead == 0.*.m.* ]] && is_load_outside "$ahead" && continue
            return 1
        fi
        rm -f "$tickets/$ahead"
    done
    return 0
}

cmd=$*
start=$(date +%FT%T%z)
load=$(load_now)
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
ticket=$tickets/${is_suite:+0.}$began.${is_suite:+${is_mods_suite:+m.}}$$
started_at $$ >"$tickets/.new.$$"
mv "$tickets/.new.$$" "$ticket"
leave() { rm -f "$ticket"; }
trap leave EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
next_say=0
until first_in_line past-load && is_calm && mkdir "$turn" 2>/dev/null; do
    # only the first in line frees a stale turn, so it never takes a turn a newer run just made
    if first_in_line && is_stale; then
        if mv "$turn" "$turn.stale.$$" 2>/dev/null; then
            freed
            echo "gate-queue: freed a dead holder's turn" >&2
            rm -rf "$turn.stale.$$"
        fi
        continue
    fi
    if [ "$waited" -ge "$wait_max" ]; then
        echo "gate-queue: waited ${waited}s, deadline passed, nothing ran. $(holder)" >&2
        log_run - 75
        exit 75
    fi
    if [ "$waited" -ge "$next_say" ]; then
        echo "gate-queue: waiting ${waited}s, $(holder)" >&2
        next_say=$((next_say + 30))
    fi
    sleep "${GATE_QUEUE_POLL:-2}"
    waited=$(($(date +%s) - began))
done

took=$(date +%s)
release() {
    local code=$? ran=$(($(date +%s) - took))
    freed
    rm -rf "$turn"
    log_run "$ran" "$code"
    # a batch run whole keeps every suite behind it: two held the turn 21 min each while four suites stood 7 to 16 (2026-11-24)
    if [ "$slot" = long ] && [ -z "$is_suite$is_hold" ] && [ "$ran" -gt "${GATE_QUEUE_BATCH_MAX:-180}" ]; then
        echo "gate-queue: this batch kept the long turn ${ran}s; run it in groups under 3 min, each its own --long, so a lane's suite goes between" >&2
    fi
}
leave
trap release EXIT
printf '%s\n%s\n%s\n' "$$" "$(started_at $$)" "$*" >"$turn/holder"
[ "$waited" -gt 0 ] && echo "gate-queue: took the turn after ${waited}s" >&2
[ -n "$is_hold" ] && hold_until_told "$@"
GATE_QUEUE_HELD=$slot "$@"
