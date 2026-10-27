#!/bin/bash
# a .scratch spec or -proposal write that carries «wish: PK-N» or «wish: FRM-N» runs wish-cover and hands a red back to the session; a red, a missing wish line or a failed run blocks the write
set -uo pipefail
event="$(cat)"
file="$(jq -r '.tool_input.file_path // ""' <<<"$event")"
case "$file" in
*/.scratch/*/spec.md | */.scratch/spec.md | */.scratch/*proposal*.md | */.scratch/*-review.md | */scratchpad/*brief*.md) ;;
*) exit 0 ;;
esac
[ -f "$file" ] || { jq -n --arg msg "wish-cover: $file not found, skipped" '{systemMessage: $msg}'; exit 0; }
head -n 10 "$file" | grep -qiE '^wish: *(PK|FRM|BYT)-[0-9]+' || {
	head -n 10 "$file" | grep -qiE '^wish: *none *$' && exit 0
	jq -n --arg reason "wish-cover: $file has no wish line in its first 10 lines — add \`wish: PK-N\` (or FRM-N, BYT-N), or \`wish: none\` when no wish of dima's stands behind it" '{decision: "block", reason: $reason}'
	exit 0
}
command -v node >/dev/null || { jq -n '{systemMessage: "wish-cover: node missing, skipped"}'; exit 0; }
# a lane spec holds a wish line per chunk section: every id in the file is checked against its own section
reds=""
for id in $(grep -iE '^wish: *(PK|FRM|BYT)-[0-9]+' "$file" | grep -iEo '(PK|FRM|BYT)-[0-9]+' | tr a-z A-Z | sort -u); do
	out="$(node "$(dirname "$0")/../../script/wish-cover.ts" "$id" "$file" 2>&1)" && continue
	[ $? -eq 1 ] || { jq -n --arg reason "wish-cover: could not run for $id on $file — ${out}" '{decision: "block", reason: $reason}'; exit 0; }
	reds+="$(grep '^✗' <<<"$out")"$'\n'
done
[ -n "$reds" ] || exit 0
jq -n --arg reason "wish-cover is red on $file — copy the wish's words verbatim: $reds" '{decision: "block", reason: $reason}'
