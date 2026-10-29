#!/bin/bash
# a .scratch spec or -proposal write that carries «wish: PK-N» or «wish: FRM-N» runs wish-cover and hands a red back to the session; a red, a missing wish line or a failed run blocks the write
set -uo pipefail
event="$(cat)"
watched() {
	case "$1" in
	*/.scratch/*/spec.md | */.scratch/spec.md | */.scratch/*proposal*.md | */.scratch/*review*.md | */scratchpad/*brief*.md) return 0 ;;
	*) return 1 ;;
	esac
}
# a Bash write (a heredoc, sd, cp) names its target in the command: every watched path in it is checked
if [ "$(jq -r '.tool_name // ""' <<<"$event")" = "Bash" ]; then
	cmd="$(jq -r '.tool_input.command // ""' <<<"$event")"
	cwd="$(jq -r '.cwd // ""' <<<"$event")"
	for tok in $(grep -oE "[^ \"'<>|;&]*\.md" <<<"$cmd" | sort -u); do
		case "$tok" in /*) f="$tok" ;; "~"/*) f="$HOME/${tok#\~/}" ;; *) f="$cwd/$tok" ;; esac
		watched "$f" && [ -f "$f" ] || continue
		# a command that only names a spec (a read, a spawn argv) leaves its mtime old
		[ $(($(date +%s) - $(stat -f %m "$f"))) -le 10 ] || continue
		out="$(jq -n --arg f "$f" '{tool_name: "Write", tool_input: {file_path: $f}}' | "$0")"
		[ -n "$out" ] && { echo "$out"; exit 0; }
	done
	exit 0
fi
file="$(jq -r '.tool_input.file_path // ""' <<<"$event")"
watched "$file" || exit 0
[ -f "$file" ] || { jq -n --arg msg "wish-cover: $file not found, skipped" '{systemMessage: $msg}'; exit 0; }
# a wish line is «wish: FRM-N», or its linked form «wish: [FRM-N](url)»
idline='^wish: *\[?(PK|FRM|BYT)-[0-9]+'
if ! head -n 10 "$file" | grep -qiE "$idline"; then
	# `none` stands only while no «wish: <id>» line exists anywhere in the file; a later chunk section still runs the loop below
	if head -n 10 "$file" | grep -qiE '^wish: *none *$'; then
		grep -qiE "$idline" "$file" || exit 0
	else
		jq -n --arg reason "wish-cover: $file has no wish line in its first 10 lines — add \`wish: PK-N\` (or FRM-N, BYT-N), or \`wish: none\` when no wish of dima's stands behind it" '{decision: "block", reason: $reason}'
		exit 0
	fi
fi
command -v node >/dev/null || { jq -n '{systemMessage: "wish-cover: node missing, skipped"}'; exit 0; }
# a lane spec holds a wish line per chunk section: every id in the file is checked against its own section
reds=""
for id in $(grep -iE "$idline" "$file" | grep -iEo '(PK|FRM|BYT)-[0-9]+' | tr a-z A-Z | sort -u); do
	out="$(node "$(dirname "$0")/../../script/wish-cover.ts" "$id" "$file" 2>&1)" && continue
	[ $? -eq 1 ] || { jq -n --arg reason "wish-cover: could not run for $id on $file — ${out}" '{decision: "block", reason: $reason}'; exit 0; }
	reds+="$(grep '^✗' <<<"$out")"$'\n'
done
[ -n "$reds" ] || exit 0
jq -n --arg reason "wish-cover is red on $file — copy the wish's words verbatim: $reds" '{decision: "block", reason: $reason}'
