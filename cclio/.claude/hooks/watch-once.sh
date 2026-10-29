#!/bin/bash
# runs a --watch hook until its first event line (or 6 h), then prints the lines and exits; kills only the pid it spawned
# after a /clear the context that armed it is gone (a clear mints a new session id): it ends silently with its session instead of waking the fresh one
armed=$CLAUDE_CODE_SESSION_ID
reg=$(grep -l "\"sessionId\": *\"$armed\"" ~/.claude/sessions/*.json 2>/dev/null | head -1)
cleared() { [ -n "$armed" ] && [ -n "$reg" ] && ! grep -q "\"sessionId\": *\"$armed\"" "$reg" 2>/dev/null; }
out=$(mktemp)
loud=$(mktemp)
quiet=$HOME/.local/state/cclio/watch-quiet.log
mkdir -p "${quiet%/*}"
# a line starting «~ » is quiet: it goes to the log, without the prefix, and does not end the wait
lines=0
drain() {
  local total=$(wc -l < "$out") line
  while [ $lines -lt $total ]; do
    lines=$((lines + 1)); line=$(sed -n "${lines}p" "$out")
    case $line in
      "~ "*) echo "$(date '+%F %T') $(basename "$1") ${line#"~ "}" >> "$quiet" ;;
      *) echo "$line" >> "$loud" ;;
    esac
  done
}
"$1" --watch > "$out" 2>&1 &
pid=$!
end=$((SECONDS + 21600))
while [ $SECONDS -lt $end ] && [ ! -s "$loud" ] && kill -0 "$pid" 2>/dev/null && ! cleared; do sleep 2; drain "$1"; done
sleep 1
drain "$1"
alive=0; kill -0 "$pid" 2>/dev/null && alive=1
kill "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
if cleared; then
  while [ -f "$reg" ]; do sleep 60; done
  exit 0
fi
if [ -s "$loud" ]; then cat "$loud"; elif [ $alive = 1 ]; then echo "watch: 6 h, no event"; else echo "watch: $1 exited with no event"; fi
