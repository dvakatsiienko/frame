#!/usr/bin/env bash
# a folded codie summon (start_session) passes only with a clean x brief check stamp for its brief's bytes,
# the check x-mod-guard runs on a claude --bg line; until: FRM-432 (x brief summon)
set -euo pipefail
input=$(cat)
title=$(jq -r '.tool_input.title // ""' <<<"$input")
[[ $title == *"🔧 codie"* ]] || exit 0
prompt=$(jq -r '.tool_input.prompt // ""' <<<"$input")
deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}
brief=""
while read -r p; do
  p=${p/#\~/$HOME}
  [[ -f $p ]] && { brief=$p; break; }
done < <(grep -oE '(~|/)[^ `"'\''«»]+\.md' <<<"$prompt" || true)
[[ -n $brief ]] || deny "a codie summon's prompt names its brief file (an existing .md path); none found"
sum=$(shasum -a 256 "$brief" | cut -d' ' -f1)
stamp="${X_STATE:-$HOME/.local/state/x}/briefs/$sum.json"
[[ -f $stamp ]] || deny "the brief has no clean x brief check stamp for its current bytes: run x brief check --repo <repo> $brief"
exit 0
