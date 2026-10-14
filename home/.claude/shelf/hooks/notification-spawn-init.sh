#!/bin/bash
# SubagentStart — work begins. The harness fires this on every subagent TURN,
# not once per spawn, and an interactive session mints a FRESH agent_id each
# turn, so first-sighting alone rings on every host reply. Two shapes are a
# genuine start, and they need different keys:
#
#   a spawned in-process agent — agent_type is set, agent_id is stable
#   a background session       — agent_type is "", the session id is the stable
#                                thing, and the registry says kind:"bg"
#
# Anything else is the host's own per-turn artifact. Measured 2026-08-24.
seen="$HOME/.claude/shelf/sounds/.agents-seen"

payload=$(cat)
id=$(printf '%s' "$payload" | jq -r '.agent_id // empty' 2>/dev/null)
[[ -n $id ]] || exit 0

if [[ -n $(printf '%s' "$payload" | jq -r '.agent_type // empty' 2>/dev/null) ]]; then
	key=$id
	sound=spawn-sub-steam-friend-online.wav
else
	sound=spawn-bg-steam-friend-join.wav
	session=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null)
	kind=$(jq -r --arg s "$session" 'select(.sessionId == $s) | .kind' \
		"$HOME"/.claude/sessions/*.json 2>/dev/null | head -1)
	[[ $kind == bg ]] || exit 0
	key=$session
fi

grep -qxF "$key" "$seen" 2>/dev/null && exit 0
printf '%s\n' "$key" >>"$seen"
# Keys are never revisited once their agent or session ends, so the file only
# needs to outlive what is running. 200 is far past any real fleet.
if (($(wc -l <"$seen") > 200)); then
	tail -100 "$seen" >"$seen.tmp" && mv "$seen.tmp" "$seen"
fi

printf '%s  SubagentStart  %s\n' "$(date +%H:%M:%S)" "$key" >>"$HOME/.claude/hook-trace.log"
# a burst (ten research readers at once) rings once per kind: one play per 10 s
stamp="$HOME/.claude/shelf/sounds/.rang-$sound"
now=$(date +%s)
last=$(cat "$stamp" 2>/dev/null || echo 0)
((now - last < 10)) && exit 0
echo "$now" >"$stamp"
afplay "$HOME/.claude/shelf/sounds/$sound" >/dev/null 2>&1 &
