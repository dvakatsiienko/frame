#!/bin/zsh
# a clio thread in its own herdr tab, from any terminal: `clio-start` main clio, opened with no message (the zsh alias
# `clio-herdr`, `pnpm clio:start`); `clio-start wing <N> [first prompt]` a fresh wing, its prompt before --remote-control
# so the claude apps' card keeps the -n name (FRM-600)
# the role is the record x brief summon writes under the session id it mints, behind its caller gate (FRM-579)
setopt err_return no_unset pipe_fail
usage='usage: clio-start | clio-start wing <N> [first prompt]'
first=()
case "${1:-main}" in
  main) name='🦉 clio'; short=clio; role=coordinator; label=seat=clio ;;
  wing)
    [[ "${2:-}" == <-> ]] || { echo "$usage" >&2; exit 2; }
    name="🦉🪽 clio: wing $2"; short="wing-$2"; role="wing:$2"; label="thread=wing-$2"
    [[ -n "${3:-}" ]] && first=("$3") ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
line="hc run --bg --no-parent --cwd $HOME/frame/_clio -- claude -n ${(qq)name}"
(( $#first )) && line+=" ${(qq)first[1]}"
line+=' --remote-control'
# run from a clio pane, the gate would refuse a role a live record of that pane holds
S=$(env -u HC_TERMINAL_ID x brief summon --apply --role "$role" --json "$line") \
  || { echo "clio-start: x brief summon refused: $S" >&2; exit 1; }
sid=$(jq -er .data.sessionId <<<"$S") && name=$(jq -er .data.display <<<"$S") || { echo "clio-start: no session in: $S" >&2; exit 1; }
J=$(hc run --bg --no-parent --no-notify --json --name "$short" --label "$label" --cwd ~/frame/_clio -- \
  claude --session-id "$sid" -n "$name" --model "${CLIO_MODEL:-claude-opus-5-5}" --effort "${CLIO_EFFORT:-medium}" "${first[@]}" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || { echo "clio-start: no address in: $J" >&2; exit 1; }
node -e "import('$HOME/frame/home/.claude/plugin-x/skills/herdr/scripts/thread-tab.ts').then(m => process.exit(m.keepThreadInTab('$T', '$name') ? 0 : 1))" \
  || { echo "clio-start: $T runs in hc but got no herdr tab, retry: herdr-app do terminal.keep '{\"terminal\":\"$T\",\"place\":\"tab\"}'" >&2; exit 1; }
(( $#first )) && next='its first prompt sent' || next='type your first message there'
echo "$name is open in herdr as $T on session $sid: $next"
