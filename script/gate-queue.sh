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
# waiters line up first come, first served inside their class: one ticket file each, named <epoch>.<pid>, a suite's 0.<epoch>.<pid>, a run the load gates <epoch>.m.<pid> after its class.
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
# a whole suite: mods, go or a package's own `pnpm test`, read word by word from where the command starts, past its wrappers; a run
# narrowed to a file or a test, a red round, or any other command is a batch. prints suite, neutral (a cd, a typecheck) or nothing
kind_of() {
    local word
    while :; do
        case ${1-} in
        [A-Za-z_]*=*) shift ;;
        time | */time | timeout | */timeout | env | */env | nice | */nice | test-vm-go.sh | */test-vm-go.sh)
            shift
            while :; do
                case ${1-} in
                -[oCuSnks]) shift 2 2>/dev/null || return 0 ;;
                -* | [0-9]* | [A-Za-z_]*=*) shift ;;
                *) break ;;
                esac
            done
            ;;
        *) break ;;
        esac
    done
    for word in "$@"; do
        case $word in --only | --only=* | --extra | --extra=* | --pairs | --pairs=* | -run | -run=* | --run | --run=* | -*test.run*) return 0 ;; esac
    done
    # past the wrappers nothing may be left, and bash 5 under -u refuses a cut of an unset $1
    local cmd=${1-}
    cmd=${cmd##*/}
    shift 2>/dev/null || return 0
    case $cmd in
    cd) echo neutral ;;
    claude) [ "${1-} ${2-}" = 'plugin test' ] && echo suite ;;
    node) case ${1-} in mods/test.ts | */mods/test.ts) echo suite ;; esac ;;
    go)
        [ "${1-}" = -C ] && shift 2
        [ "${1-}" = test ] || return 0
        for word in "$@"; do
            case $word in . | ./... | */...) echo suite && return 0 ;; esac
        done
        ;;
    pnpm)
        while :; do
            case ${1-} in
            -C | --filter) shift 2 2>/dev/null || return 0 ;;
            -* | run) shift ;;
            *) break ;;
            esac
        done
        case ${1-} in
        node) case ${2-} in mods/test.ts | */mods/test.ts) echo suite ;; esac ;;
        mods:test | x-go:test | x-go:gate) echo suite ;;
        typecheck | *:typecheck) echo neutral ;;
        test | *:test)
            shift
            for word in "$@"; do
                case $word in -* | [0-9]\>* | \>*) ;; *) return 0 ;; esac
            done
            echo suite
            ;;
        esac
        ;;
    esac
}
# a shell line counts when every link of its && chain does, one of them a suite
is_suite_run() {
    local line kind got=1
    case ${1##*/} in
    sh | bash | zsh) ;;
    *) [ "$(kind_of "$@")" = suite ] && return 0 || return 1 ;;
    esac
    case ${2-} in -c | -lc) ;; *) return 1 ;; esac
    line=${3-}
    # plain words and their redirects alone: a link, a job or a substitution the split does not know makes the line a batch
    case $(printf %s "$line" | sed -E 's/&&/ /g; s/[0-9]*>&[0-9]//g') in *[!A-Za-z0-9_./=:@,+%*~\$\"\'\ \>-]*) return 1 ;; esac
    while [ -n "$line" ]; do
        # shellcheck disable=SC2086
        kind=$(set -f && kind_of ${line%%&&*})
        [ -n "$kind" ] || return 1
        [ "$kind" = suite ] && got=0
        case $line in *'&&'*) line=${line#*&&} ;; *) line= ;; esac
    done
    return $got
}
is_suite=
[ "$slot$is_hold" = long ] && is_suite_run "$@" && is_suite=1
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

# a second log beside the first, one row a run that took or waited for a turn, to measure the load gate: start, slot, mods suite (1/0),
# idle % at the start (the mean of 3 one-second iostat samples, the first being the boot average), the 1-min load, wait s, run s, the
# child's cpu s, the slowest of 5 /usr/bin/true spawns in ms. the sampling runs beside the wait, so a run never starts later for it, and
# a field the sample did not finish or could not read is -; nothing reads this log to decide anything
cpu_log=$state/gate-queue-cpu.log
sample=$state/gate-queue-cpu.sample.$$
take_sample() {
    local spawn idle
    spawn=$(perl -MTime::HiRes=time -e 'for (1 .. 5) { $t = time; system("/usr/bin/true"); $d = (time - $t) * 1000; $m = $d if $d > $m } printf "%.0f", $m' 2>/dev/null)
    idle=$(iostat -w 1 -c $((${GATE_QUEUE_IDLE_SAMPLES:-3} + 1)) -n 0 2>/dev/null | awk '$1 ~ /^[0-9]+$/ && NF >= 3 { n++; if (n > 1) { sum += $3; kept++ } } END { if (kept > 0) printf "%.0f", sum / kept }')
    printf '%s\t%s\n' "${idle:--}" "${spawn:--}" >"$sample.tmp" && mv "$sample.tmp" "$sample"
}
# the cpu seconds (user + sys) of every child this shell has waited for, into cpu_now; `times` runs in this shell, never in a
# substitution or a pipe, whose fork would report its own children; bash prints them on its second line
read_children_cpu() {
    times >"$sample.times"
    cpu_now=$(sed -n 2p "$sample.times" | awk '{ for (i = 1; i <= 2; i++) { split($i, p, "m"); s += p[1] * 60 + p[2] } printf "%.1f", s }')
}
# one row to the sibling log, then the sample is done with
log_cpu() {
    local idle=- spawn=- cpu=${2--}
    [ -s "$sample" ] && IFS=$'\t' read -r idle spawn <"$sample"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$slot" "${is_mods_suite:-0}" "${idle:--}" "$load" "$waited" "${1--}" "$cpu" "${spawn:--}" >>"$cpu_log"
    kill "$sampler" 2>/dev/null
    rm -f "$sample" "$sample.tmp" "$sample.times"
}

freed() { [ "$slot" != long ] || { date +%s >"$turn.freed.$$" && mv "$turn.freed.$$" "$turn.freed"; }; }
# the turn stood free for the suite of this ticket, 2 min from its arrival or the last release, and the load kept it out
is_load_outside() {
    local born=${1#0.} last=0 now
    # a held turn first: its release writes the time before the turn goes
    [ -d "$turn" ] && return 1
    now=$(date +%s)
    born=${born%%.*}
    { read -r last; } 2>/dev/null <"$turn.freed"
    case $last in '' | 0* | *[!0-9]*) last=0 ;; esac
    [ "$last" -gt "$now" ] && last=0
    [ "$born" -gt "$last" ] && last=$born
    [ $((now - last)) -ge "${GATE_QUEUE_LOAD_GRACE:-120}" ] && ! is_low_load
}

# a ticket ahead whose owner is gone leaves the line; true when this run's ticket is the first, or, asked `past-load`, when only runs
# the load keeps out stand ahead of it
first_in_line() {
    local ahead since now
    for ahead in $(ls "$tickets"); do
        [ "$tickets/$ahead" = "$ticket" ] && return 0
        since=
        { read -r since; } 2>/dev/null <"$tickets/$ahead"
        now=$(started_at "${ahead##*.}")
        if [ -n "$now" ] && [ "$now" = "$(one_line "$since")" ]; then
            [ "${1-}" = past-load ] && [[ $ahead == *.m.* ]] && is_load_outside "$ahead" && continue
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
(take_sample) </dev/null >/dev/null 2>&1 &
sampler=$!
ticket=$tickets/${is_suite:+0.}$began.${is_mods_suite:+m.}$$
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
        freed
        if mv "$turn" "$turn.stale.$$" 2>/dev/null; then
            echo "gate-queue: freed a dead holder's turn" >&2
            rm -rf "$turn.stale.$$"
        fi
        continue
    fi
    if [ "$waited" -ge "$wait_max" ]; then
        echo "gate-queue: waited ${waited}s, deadline passed, nothing ran. $(holder)" >&2
        log_run - 75
        log_cpu - -
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
read_children_cpu
cpu_before=$cpu_now
release() {
    local code=$? ran=$(($(date +%s) - took)) cpu
    read_children_cpu
    cpu=$(awk -v now="$cpu_now" -v was="$cpu_before" 'BEGIN { printf "%.1f", now - was }')
    freed
    rm -rf "$turn"
    log_run "$ran" "$code"
    log_cpu "$ran" "$cpu"
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
