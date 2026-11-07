#!/bin/bash
# whole go suite, slim git first on PATH against brew's, abba; each run takes its own long turn
export LANG=en_US.UTF-8
state="$HOME/.local/state/x/lanes/frm-525"
slim_bin="$state/slim-git/out/bin"
tree=/Users/dima/frame/.claude/worktrees/fork-483eb11c
queue=/Users/dima/frame/script/gate-queue.sh
rows="$state/slim-ab.tsv"

one() {
    local label=$1 path=$2 log
    log="$state/slim-ab-$label.log"
    "$queue" --long env PATH="$path" /usr/bin/time -p go -C "$tree/x/go" test -count=1 . >"$log" 2>&1
    local code=$?
    printf '%s\tload %s\t%s\texit %s\t%s\n' "$label" "$(sysctl -n vm.loadavg | cut -d' ' -f2)" \
        "$(awk '/^real/ {r=$2} /^user/ {u=$2} /^sys/ {s=$2} END {printf "real %s user %s sys %s cpu %.1f", r, u, s, u+s}' "$log")" \
        "$code" "$(grep -cE '^--- FAIL' "$log") failed" >>"$rows"
    tail -n 1 "$rows"
}

one brew-1 "$PATH"
one slim-1 "$slim_bin:$PATH"
one slim-2 "$slim_bin:$PATH"
one brew-2 "$PATH"

trace="$state/trace2-suite.jsonl"
"$queue" --long env GIT_TRACE2_EVENT="$trace" /usr/bin/time -p go -C "$tree/x/go" test -count=1 . >"$state/trace2-suite.log" 2>&1
echo "trace2 exit $? size $(wc -c <"$trace")"
