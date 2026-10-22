#!/bin/bash
# a .scratch spec or -proposal write that carries «wish: PK-N» runs wish-cover and hands a red back to the session; never blocks the write
set -uo pipefail
event="$(cat)"
file="$(jq -r '.tool_input.file_path // ""' <<<"$event")"
case "$file" in
*/.scratch/*/spec.md | */.scratch/spec.md | */.scratch/*-proposal.md) ;;
*) exit 0 ;;
esac
[ -f "$file" ] || { echo "wish-cover: $file not found, skipped"; exit 0; }
id="$(head -n 10 "$file" | grep -iEo '^wish: *PK-[0-9]+' | head -n 1 | grep -iEo 'PK-[0-9]+')" || exit 0
command -v node >/dev/null || { echo "wish-cover: node missing, skipped"; exit 0; }
out="$(node "$HOME/frame/cclio/script/wish-cover.ts" "$id" "$file" 2>&1)" && exit 0
[ $? -eq 1 ] || { echo "wish-cover: could not run for $id on $file, skipped"; exit 0; }
reds="$(grep '^✗' <<<"$out")"
jq -n --arg reason "wish-cover is red on $file — copy the wish's words verbatim: $reds" '{decision: "block", reason: $reason}'
