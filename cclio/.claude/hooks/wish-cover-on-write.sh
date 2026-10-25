#!/bin/bash
# a .scratch spec or -proposal write that carries «wish: PK-N» or «wish: FRM-N» runs wish-cover and hands a red back to the session; never blocks the write
set -uo pipefail
event="$(cat)"
file="$(jq -r '.tool_input.file_path // ""' <<<"$event")"
case "$file" in
*/.scratch/*/spec.md | */.scratch/spec.md | */.scratch/*-proposal.md | */.scratch/*-review.md | */scratchpad/*brief*.md) ;;
*) exit 0 ;;
esac
[ -f "$file" ] || { jq -n --arg msg "wish-cover: $file not found, skipped" '{systemMessage: $msg}'; exit 0; }
line="$(head -n 10 "$file" | grep -iE '^wish: *(PK|FRM)-[0-9]+' | head -n 1)" || {
	head -n 10 "$file" | grep -qiE '^wish: *none *$' && exit 0
	jq -n --arg reason "wish-cover: $file has no wish line in its first 10 lines — add \`wish: PK-N\` (or FRM-N), or \`wish: none\` when no wish of dima's stands behind it" '{decision: "block", reason: $reason}'
	exit 0
}
id="$(grep -iEo 'PK-[0-9]+' <<<"$line" | head -n 1)" || id="$(grep -iEo 'FRM-[0-9]+' <<<"$line" | head -n 1)"
command -v node >/dev/null || { jq -n '{systemMessage: "wish-cover: node missing, skipped"}'; exit 0; }
out="$(node "$HOME/frame/cclio/script/wish-cover.ts" "$id" "$file" 2>&1)" && exit 0
[ $? -eq 1 ] || { jq -n --arg reason "wish-cover: could not run for $id on $file — ${out}" '{decision: "block", reason: $reason}'; exit 0; }
reds="$(grep '^✗' <<<"$out")"
jq -n --arg reason "wish-cover is red on $file — copy the wish's words verbatim: $reds" '{decision: "block", reason: $reason}'
