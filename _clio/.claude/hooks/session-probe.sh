#!/bin/bash
# passive probe for PK-158 (fork-guard) and PK-152 (/clear): one json line per SessionStart and Stop —
# the event's ids and source, and the process chain above the hook with each pid's registry sessionId.
# append-only, never blocks; dies when both items close
log="$HOME/.local/state/clio/session-probe.log"
mkdir -p "$(dirname "$log")"
payload=$(cat)
chain='[]'
pid=$PPID
for _ in 1 2 3 4 5; do
    [ -z "$pid" ] || [ "$pid" -le 1 ] && break
    comm=$(ps -o comm= -p "$pid" 2>/dev/null | xargs basename 2>/dev/null)
    reg="$HOME/.claude/sessions/$pid.json"
    sid=$([ -f "$reg" ] && jq -r '.sessionId // empty' "$reg" 2>/dev/null)
    name=$([ -f "$reg" ] && jq -r '.name // empty' "$reg" 2>/dev/null)
    chain=$(jq -c --arg p "$pid" --arg c "$comm" --arg s "$sid" --arg n "$name" '. + [{pid:$p, comm:$c, registry:$s, name:$n}]' <<<"$chain")
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
jq -c --arg t "$(date '+%F %T')" --argjson chain "$chain" \
    '{t:$t, event:.hook_event_name, source:.source, session:.session_id, cwd:.cwd, transcript:.transcript_path, chain:$chain}' \
    <<<"$payload" >>"$log" 2>/dev/null
exit 0
