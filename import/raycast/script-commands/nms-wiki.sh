#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title nms wiki
# @raycast.mode silent
# @raycast.packageName No Man's Sky
# @raycast.icon 🪐
# @raycast.argument1 { "type": "text", "placeholder": "item, or empty for the selection", "optional": true }
# @raycast.description Open a No Man's Sky wiki page — the typed name, or the selected text when nothing is typed. The wiki's search jumps to an exact page, or lists results.

query="$1"
if [ -z "$query" ]; then
    saved=$(pbpaste)
    pbcopy </dev/null
    osascript -e 'tell application "System Events" to keystroke "c" using command down'
    sleep 0.2
    query=$(pbpaste)
    printf '%s' "$saved" | pbcopy
fi

query=$(printf '%s' "$query" | tr '\n' ' ' | sed 's/^ *//; s/ *$//')
if [ -z "$query" ]; then
    echo "type an item, or select its name first"
    exit 1
fi

encoded=$(printf '%s' "$query" | jq -sRr @uri)
open "https://nomanssky.miraheze.org/w/index.php?title=Special:Search&go=Go&search=$encoded"
echo "wiki: $query"
