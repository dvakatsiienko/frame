#!/bin/zsh
# traces a steamac game session, read-only: steamac-trace.sh [seconds=900] [--perf]; --perf costs one vCPU
set -uo pipefail
seconds=900
perf=
for arg in "$@"; do
  case $arg in
    --perf) perf=--perf ;;
    <->) seconds=$arg ;;
    *) print -u2 "usage: steamac-trace.sh [seconds=900] [--perf]"; exit 2 ;;
  esac
done
out=~/.local/share/steamac/trace-$(date +%m%d-%H%M)
mkdir -p "$out"
ssh_vm=${0:A:h}/steamac-ssh.sh

timeout $((seconds + 30)) vm_stat 1 |
  awk '{ "date +%T" | getline t; close("date +%T"); print t, $0; fflush() }' > "$out/mac-memory.log" &

timeout $((seconds + 30)) tail -n 0 -F ~/Library/Logs/es.fxgam.steamac/steamac-vm.log 2>/dev/null |
  LC_ALL=C grep -a --line-buffered -E 'perf: |stall: |no-picture|game stats:|memory: t=' |
  while IFS= read -r l; do print -r -- "$(date +%T) ${l[1,240]}"; done > "$out/launcher.log" &

"$ssh_vm" "bash -s $seconds" > "$out/guest-threads.log" 2>&1 <<'E' &
top -H -b -d 1 -n "$1" -w 160 | awk '/^top - /{print "@ "$3; system("cat /proc/pressure/cpu /proc/pressure/io /proc/pressure/memory | cut -c1-30"); next} /^(%Cpu|MiB)/{print; next} $9+0>=8{print}'
E

if [[ $perf == --perf ]]; then
  "$ssh_vm" "bash -s $seconds" > "$out/guest-perf.log" 2>&1 <<'E' &
for i in $(seq 1 "$1"); do pid=$(pgrep -x GTAIV.exe | head -1); [ -n "$pid" ] && break; sleep 1; done
[ -z "$pid" ] && { echo "no game started"; exit 1; }
mkdir -p /tmp/steamac-trace; echo "pid $pid at $(date +%T)"
timeout -s INT "$1" perf record -q -F 199 -T -p "$pid" -o /tmp/steamac-trace/p.data 2>&1 | tail -2
E
fi

print "tracing for $seconds s into $out"
wait
print "trace done: $out"
