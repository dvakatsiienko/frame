#!/bin/bash
# a pocket write runs pocket-check and hands a red back to the session; backlog's own hook fires on a status move only (PK-89)
set -uo pipefail
event="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$event")"
case "$tool" in
Bash)
	# a redirect to /dev/null or a fd dup is no write
	cmd="$(jq -r '.tool_input.command // ""' <<<"$event" | sed -E 's#[0-9]*>>?[[:space:]]*/dev/null##g; s#[0-9]*>&[0-9]+##g')"
	# write verbs only; a read (grep, cat, ls) of the pocket never fires it
	grep -qE 'backlog task (create|edit|archive|demote)|pocket-(add|move)\.ts' <<<"$cmd" ||
		{ grep -qE 'pocket/(archive/)?tasks|pocket(/|[[:space:]]|$)' <<<"$cmd" && sed -E "s/\"[^\"]*\"/Q/g; s/'[^']*'/Q/g" <<<"$cmd" | grep -qE '(^|[[:space:];&|(])(mv|trash|rm|tee|cp)[[:space:]]|git[[:space:]]+(checkout|restore|stash|rm|mv)[[:space:]]|git[[:space:]]+clean|git[[:space:]]+stash[[:space:]]+push|[[:space:]]-delete([[:space:]]|$)|sed[[:space:]]+(-[a-zA-Z]*[[:space:]]+)*-i|perl[[:space:]]+-[a-z]*i|>[[:space:]]*[^&=[:space:]]'; } || exit 0
	;;
Edit | Write) jq -r '.tool_input.file_path // ""' <<<"$event" | grep -q '/pocket/' || exit 0 ;;
*) exit 0 ;;
esac
# the seat decides whose reds block: a wing answers for its own label, main for every other item, a parked sidecar for nothing
sid="$(jq -r '.session_id // ""' <<<"$event")"
registry="$(grep -lE "\"sessionId\": *\"$sid\"" "${HOME:-/nonexistent}"/.claude/sessions/*.json 2>/dev/null | head -1)"
[ -n "$registry" ] && [ "$(jq -r '.kind // ""' "$registry" 2>/dev/null)" = bg ] && exit 0
seat_label=""
[ -n "$registry" ] && [[ "$(jq -r '.name // ""' "$registry" 2>/dev/null)" =~ wing\ ([0-9]+) ]] && seat_label="clio-wing-${BASH_REMATCH[1]}"
main_session="$(sed -n 's/^session=//p' "${HOME:-/nonexistent}/.local/state/clio/main-session" 2>/dev/null)"
[ -z "$seat_label" ] && [ -n "$main_session" ] && [ "$main_session" != "$sid" ] && exit 0

check="${POCKET_CHECK_CMD:-node $(dirname "$0")/../../script/pocket-check.ts}"
out="$($check 2>&1)"
status=$?

# every pocket write becomes a commit, green or red, so git is the net; it runs detached because a pocket-only `x lane commit` takes ~10 s
root="$(git -C "$(dirname "$0")/../.." rev-parse --show-toplevel 2>/dev/null)"
paths=()
ids=()
if [ -n "$root" ]; then
	skip=0
	while IFS= read -r -d '' entry; do
		# a rename or copy lists its origin as a bare second entry
		if [ "$skip" = 1 ]; then
			paths+=("$entry")
			skip=0
			continue
		fi
		paths+=("${entry:3}")
		[[ "${entry:0:1}" == [RC] ]] && skip=1
		id="$(basename "${entry:3}" | grep -oiE '^pk-[0-9]+')" && ids+=("$id")
	done < <(git -C "$root" status --porcelain -z -uall -- _clio/pocket)
fi
state="${HOME:+$HOME/.local/state/clio/pocket-commits}"
# a refused commit leaves git behind the pocket, so the next write reds until a commit lands
refused=""
[ -n "$state" ] && grep -q '^refused' "$state/last" 2>/dev/null &&
	refused="🔴 the last pocket auto-commit was refused ($(cat "$state/last")): read $state/log.txt and fix its cause"

# the runner twin runs with an empty HOME: it skips the commit, the main checkout's session makes it
if [ "${#paths[@]}" -gt 0 ] && [ -n "$state" ]; then
	mkdir -p "$state"
	msg="$(mktemp "$state/msg.XXXXXX")"
	printf '📜 pocket: %s (auto)\n\nthe pocket hook committed this pocket write\n' "$(IFS=,; printf '%s' "${ids[*]-}")" >"$msg"
	# the whole list is redirected: a background `a && b >/dev/null` keeps the hook's stdout open until b ends, and cc then drops the block
	(cd "$root" && nohup bash -c 'state=$1; m=$2; shift 2; out=$("$@" 2>&1 </dev/null); code=$?; printf "%s\n" "$out" >>"$state/log.txt"; if [ "$code" = 0 ] || grep -q "empty diff, no commit" <<<"$out"; then echo ok >"$state/last"; else echo "refused $(date "+%F %H:%M")" >"$state/last"; fi; rm -f -- "$m"' _ "$state" "$msg" ${POCKET_COMMIT_CMD:-x lane commit} "$msg" -- "${paths[@]}") >/dev/null 2>&1 </dev/null &
fi

[ "$status" = 0 ] && [ -z "$refused" ] && exit 0
reds="$( [ "$status" = 0 ] || grep '^🔴' <<<"$out" || printf '%s' "$out")"

# an item red blocks once per id until its text changes; a red with no item, or an item with no file, always blocks
seen="${HOME:+$HOME/.local/state/clio/pocket-reds-seen}"
[ -n "$seen" ] && mkdir -p "$(dirname "$seen")"
for id in $(grep -oE '^🔴 [A-Za-z]+-[0-9]+' <<<"$reds" | cut -d' ' -f2 | sort -u); do
	lines="$(grep -F "🔴 $id:" <<<"$reds")"
	file="$(ls "$(dirname "$0")"/../../pocket/{,archive/}tasks/"$(tr 'A-Z' 'a-z' <<<"$id") "*.md 2>/dev/null | head -1)"
	if [ -n "$file" ] && [ "$(awk 'NR > 1 && /^---$/ {exit} /^[ ]*- clio-wing-[0-9]+$/ {print $2; exit}' "$file")" != "$seat_label" ]; then
		reds="$(grep -vF "🔴 $id:" <<<"$reds")"
		continue
	fi
	[ -n "$seen" ] || continue
	sum="$(cksum <<<"$lines" | cut -d' ' -f1)"
	if grep -qx "$id $sum" "$seen" 2>/dev/null; then
		reds="$(grep -vF "🔴 $id:" <<<"$reds")"
	else
		{ grep -v "^$id " "$seen" 2>/dev/null; echo "$id $sum"; } >"$seen.tmp" && mv "$seen.tmp" "$seen"
	fi
done
reds="$(sed '/^$/d' <<<"$reds")"
[ -z "$reds" ] && [ -z "$refused" ] && exit 0
jq -n --arg reason "the pocket is red — fix it now: $(printf '%s\n%s' "$refused" "$reds" | sed '/^$/d')" '{decision: "block", reason: $reason}'
