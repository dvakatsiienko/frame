#!/bin/zsh
# main clio in a herdr tab named «🦉 clio», opened with no message: the zsh alias `clio-herdr` or `pnpm clio:start`, from any terminal
# her role is the record x brief summon writes under the session id it mints, behind its caller gate (FRM-579)
S=$(x brief summon --role coordinator --json "hc run --bg --no-parent --cwd $HOME/frame/_clio -- claude -n clio --remote-control") \
  || { echo "clio-start: x brief summon refused: $S" >&2; exit 1; }
sid=$(jq -er .data.sessionId <<<"$S") && name=$(jq -er .data.display <<<"$S") || { echo "clio-start: no session in: $S" >&2; exit 1; }
J=$(hc run --bg --no-parent --no-notify --json --name clio --label seat=clio --cwd ~/frame/_clio -- \
  claude --session-id "$sid" -n "$name" --model "${CLIO_MODEL:-claude-opus-5-5}" --effort "${CLIO_EFFORT:-medium}" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || { echo "clio-start: no address in: $J" >&2; exit 1; }
node -e "import('$HOME/frame/home/.claude/plugin-x/skills/herdr/scripts/thread-tab.ts').then(m => process.exit(m.keepThreadInTab('$T', '$name') ? 0 : 1))" \
  || { echo "clio-start: $T runs in hc but got no herdr tab, retry: herdr-app do terminal.keep '{\"terminal\":\"$T\",\"place\":\"tab\"}'" >&2; exit 1; }
echo "$name is open in herdr as $T on session $sid: type your first message there"
