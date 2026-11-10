#!/bin/zsh
# main clio in a herdr tab named «🦉 clio»: `pnpm clio:start [handoff slug]`; run it from any terminal, rex or herdr
slug=${1:-}
J=$(hc run --bg --no-parent --no-notify --json --name clio --label seat=clio --cwd ~/frame/_clio -- \
  claude -n '🦉 clio' --model "${CLIO_MODEL:-claude-fable-5-2}" --effort "${CLIO_EFFORT:-medium}" "/clio:boot $slug" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || exit 1
K=$(herdr-app do terminal.keep "{\"terminal\":\"$T\",\"place\":\"tab\"}") || exit 1
TAB=$(printf '%s' "$K" | jq -er .tab) && herdr-app do tab.rename "{\"id\":\"$TAB\",\"name\":\"🦉 clio\"}" > /dev/null
echo "🦉 clio started in herdr as $T${slug:+, booting on $slug}"
