#!/bin/zsh
# main clio in a herdr tab named «🦉 clio», opened with no message: the zsh alias `clio-herdr` or `pnpm clio:start`, from any terminal
J=$(hc run --bg --no-parent --no-notify --json --name clio --label seat=clio --cwd ~/frame/_clio -- \
  claude -n '🦉 clio' --model "${CLIO_MODEL:-claude-opus-5-5}" --effort "${CLIO_EFFORT:-medium}" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || { echo "clio-start: no address in: $J" >&2; exit 1; }
# herdr-app prints its errors on stdout, and the app may not see a fresh terminal yet: retry, then say why
for i in {1..10}; do
  K=$(herdr-app do terminal.keep "{\"terminal\":\"$T\",\"place\":\"tab\"}") && break
  sleep 0.5
done
TAB=$(printf '%s' "$K" | jq -er .tab) || { echo "clio-start: $T runs in hc but got no tab: $K" >&2; exit 1; }
herdr-app do tab.rename "{\"id\":\"$TAB\",\"name\":\"🦉 clio\"}" > /dev/null
echo "🦉 clio is open in herdr as $T: type your first message there"
