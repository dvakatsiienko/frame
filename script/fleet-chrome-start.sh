#!/bin/sh
# starts the fleet Chrome (own profile, debug port 9333) when it is down; never touches a running Chrome or dima's own profile.
# usage: script/fleet-chrome-start.sh   prints «fleet chrome: already up» or «fleet chrome: started»; exit 1 with one line when the port stays closed
set -eu
url=http://127.0.0.1:9333/json/version

if curl -sf -m 2 "$url" >/dev/null 2>&1; then
  echo "fleet chrome: already up"
  exit 0
fi

open -g -na "Google Chrome" --args --remote-debugging-port=9333 --user-data-dir="$HOME/.local/state/fleet-chrome" --no-first-run --no-default-browser-check

tries=0
while [ "$tries" -lt 30 ]; do
  if curl -sf -m 2 "$url" >/dev/null 2>&1; then
    echo "fleet chrome: started"
    exit 0
  fi
  tries=$((tries + 1))
  sleep 0.5
done
echo "fleet chrome: port 9333 stayed closed for 15 s" >&2
exit 1
