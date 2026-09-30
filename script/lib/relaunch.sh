#!/bin/sh
# restarts a launchd agent onto a freshly swapped binary: `kickstart -k` right after the swap died with
# OS_REASON_CODESIGNING and sat out the 30 s throttle (x-speak, 3 of 3, 2026-09-30); bootout + bootstrap starts it at once.
# usage: script/lib/relaunch.sh <label> — the plist is ~/Library/LaunchAgents/<label>.plist
set -eu
domain="gui/$(id -u)"
launchctl bootout "$domain/$1" 2>/dev/null || true
# bootout returns before the teardown ends, and a bootstrap inside that window fails with «5: Input/output error»
tries=0
while launchctl print "$domain/$1" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 50 ]; then
        echo "relaunch: $1 still loaded after 10 s" >&2
        exit 1
    fi
    sleep 0.2
done
launchctl bootstrap "$domain" "$HOME/Library/LaunchAgents/$1.plist"
