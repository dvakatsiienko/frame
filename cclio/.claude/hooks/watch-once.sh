#!/bin/bash
# runs a --watch hook until its first event line (or 6 h), then prints the lines and exits; kills only the pid it spawned
# after a /clear the context that armed it is gone (a clear mints a new session id): it ends silently with its session instead of waking the fresh one
armed=$CLAUDE_CODE_SESSION_ID
reg=$(grep -l "\"sessionId\": *\"$armed\"" ~/.claude/sessions/*.json 2>/dev/null | head -1)
cleared() { [ -n "$armed" ] && [ -n "$reg" ] && ! grep -q "\"sessionId\": *\"$armed\"" "$reg" 2>/dev/null; }
out=$(mktemp)
"$1" --watch > "$out" 2>&1 &
pid=$!
end=$((SECONDS + 21600))
while [ $SECONDS -lt $end ] && [ ! -s "$out" ] && kill -0 "$pid" 2>/dev/null && ! cleared; do sleep 2; done
sleep 1
alive=0; kill -0 "$pid" 2>/dev/null && alive=1
kill "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
if cleared; then
  while [ -f "$reg" ]; do sleep 60; done
  exit 0
fi
if [ -s "$out" ]; then cat "$out"; elif [ $alive = 1 ]; then echo "watch: 6 h, no event"; else echo "watch: $1 exited with no event"; fi
