#!/bin/zsh
# main clio in a herdr tab named «🦉 clio», opened with no message: the zsh alias `clio-herdr` or `pnpm clio:start`, from any terminal
J=$(hc run --bg --no-parent --no-notify --json --name clio --label seat=clio --cwd ~/frame/_clio -- \
  claude -n '🦉 clio' --model "${CLIO_MODEL:-claude-opus-5-5}" --effort "${CLIO_EFFORT:-medium}" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || { echo "clio-start: no address in: $J" >&2; exit 1; }
node -e "import('$HOME/frame/home/.claude/plugin-x/skills/herdr/scripts/thread-tab.ts').then(m => process.exit(m.keepThreadInTab('$T', '🦉 clio') ? 0 : 1))" \
  || { echo "clio-start: $T runs in hc but got no herdr tab, retry: herdr-app do terminal.keep '{\"terminal\":\"$T\",\"place\":\"tab\"}'" >&2; exit 1; }
echo "🦉 clio is open in herdr as $T: type your first message there"
