#!/bin/bash
# runs a --watch hook until its first event line (or 6 h), then prints the lines and exits; kills only the pid it spawned
out=$(mktemp)
"$1" --watch > "$out" 2>&1 &
pid=$!
end=$((SECONDS + 21600))
while [ $SECONDS -lt $end ] && [ ! -s "$out" ] && kill -0 "$pid" 2>/dev/null; do sleep 2; done
sleep 1
kill "$pid" 2>/dev/null
if [ -s "$out" ]; then cat "$out"; elif kill -0 "$pid" 2>/dev/null; then echo "watch: 6 h, no event"; else echo "watch: $1 exited with no event"; fi
