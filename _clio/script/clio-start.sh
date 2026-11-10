#!/bin/zsh
# main clio in a herdr tab named «🦉 clio», opened with no message: the zsh alias `clio-herdr` or `pnpm clio:start`, from any terminal
J=$(hc run --bg --no-parent --no-notify --json --name clio --label seat=clio --cwd ~/frame/_clio -- \
  claude -n '🦉 clio' --model "${CLIO_MODEL:-claude-opus-5-5}" --effort "${CLIO_EFFORT:-medium}" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || exit 1
K=$(herdr-app do terminal.keep "{\"terminal\":\"$T\",\"place\":\"tab\"}") || exit 1
TAB=$(printf '%s' "$K" | jq -er .tab) && herdr-app do tab.rename "{\"id\":\"$TAB\",\"name\":\"🦉 clio\"}" > /dev/null
echo "🦉 clio is open in herdr as $T: type your first message there"
