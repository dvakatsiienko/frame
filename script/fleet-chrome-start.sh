#!/bin/bash
# starts the fleet Chrome (own profile, debug port 9333) when it is down; never touches a running Chrome or dima's own profile.
# usage: script/fleet-chrome-start.sh   prints «fleet chrome: already up» or «fleet chrome: started»; exit 1 with one line when it cannot start
set -eu
url=http://127.0.0.1:9333/json/version
profile="$HOME/.local/state/fleet-chrome"

if curl -sf -m 2 "$url" >/dev/null 2>&1; then
  echo "fleet chrome: already up"
  exit 0
fi

# chrome leaves a SingletonLock symlink («host-pid») in a profile it runs, and after a crash or reboot a stale one: only a live pid counts
if [ -L "$profile/SingletonLock" ]; then
  pid=$(readlink "$profile/SingletonLock" | sed 's/.*-//')
  if kill -0 "$pid" 2>/dev/null; then
    echo "fleet chrome: running without the debug port, quit it and rerun" >&2
    exit 1
  fi
fi

open -g -na "Google Chrome" --args --remote-debugging-port=9333 --user-data-dir="$profile" --no-first-run --no-default-browser-check

start=$SECONDS
while [ $((SECONDS - start)) -lt 15 ]; do
  if curl -sf -m 2 "$url" >/dev/null 2>&1; then
    echo "fleet chrome: started"
    exit 0
  fi
  sleep 0.5
done
echo "fleet chrome: port 9333 stayed closed for $((SECONDS - start)) s" >&2
exit 1
