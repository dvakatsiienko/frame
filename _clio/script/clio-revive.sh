#!/bin/zsh
# brings a dead clio thread back on its own session, in its own herdr tab: the zsh alias `clio-revive main|wing <N>`
# the launch repeats clio-start.sh's line plus --resume, its model and effort read off the dead thread's last request:
# any difference rewrites the whole history uncached (probe 2026-11-11, FRM-575: killed idle 83 % hot, mid-tool 99 %)
setopt err_return no_unset pipe_fail
usage='usage: clio-revive main | clio-revive wing <N>'
case "${1:-}" in
  main) name='🦉 clio'; short=clio; role=coordinator; wing=0 ;;
  wing) [[ "${2:-}" == <-> ]] || { echo "$usage" >&2; exit 2; }; name="🦉🪽 clio: wing $2"; short="wing-$2"; role="wing:$2"; wing=$2 ;;
  crow|helga) echo "clio-revive: $1 restarts by its own door: crow 'pnpm -C ~/frame crow:start opus --pane', helga by the next groom" >&2; exit 2 ;;
  *) echo "$usage" >&2; exit 2 ;;
esac

# alive by its record's role, never by a name (FRM-579)
live=$(x thread list --json | jq -r --arg r "${role%%:*}" --argjson w "$wing" '.data.threads[] | select(.role == $r and (.wing // 0) == $w and .pid != null) | .pid')
[[ -z "$live" ]] || { echo "clio-revive: «$name» is alive (pid $live), nothing to revive" >&2; exit 1; }

needle="\"customTitle\":$(jq -n --arg n "$name" '$n')"
transcript=''
for f in $(ls -t ~/.claude/projects/-Users-dima-frame--clio/*.jsonl); do
  grep -qF "$needle" "$f" && { transcript=$f; break; }
done
[[ -n "$transcript" ]] || { echo "clio-revive: no transcript of «$name» in ~/.claude/projects/-Users-dima-frame--clio" >&2; exit 1; }

sid=${transcript:t:r}
params=$(jq -c 'select(.type == "api-request") | .params | {model, effort: (.output_config.effort // .effort)}' "$transcript" | tail -n 1)
model=$(jq -r '.model // empty' <<<"$params"); model=${model:-claude-opus-5-5}
effort=$(jq -r '.effort // empty' <<<"$params"); effort=${effort:-medium}

J=$(hc run --bg --no-parent --no-notify --json --name "$short" --label "thread=$short" --cwd ~/frame/_clio -- \
  claude --resume "$sid" -n "$name" --model "$model" --effort "$effort" --remote-control) || exit 1
T=$(printf '%s' "$J" | jq -er .address) || { echo "clio-revive: no address in: $J" >&2; exit 1; }
# a resume keeps the session id, but a dead thread's record left the store: x brief summon records the live one again
for _ in {1..30}; do
  jq -e --arg s "$sid" 'select(.sessionId == $s)' /dev/null ~/.claude/sessions/*.json(N) >/dev/null 2>&1 && break
  sleep 1
done
# run from dima's herdr pane, the gate would refuse a coordinator's role while main's record lives
env -u HC_TERMINAL_ID x brief summon --role "$role" --session "$sid" >/dev/null \
  || { echo "clio-revive: «$name» is back as $T but has no record: x brief summon --role $role --session $sid" >&2; exit 1; }
node -e "import('$HOME/frame/home/.claude/plugin-x/skills/herdr/scripts/thread-tab.ts').then(m => process.exit(m.keepThreadInTab('$T', '$name') ? 0 : 1))" \
  || { echo "clio-revive: $T runs in hc but got no herdr tab, retry: herdr-app do terminal.keep '{\"terminal\":\"$T\",\"place\":\"tab\"}'" >&2; exit 1; }
echo "«$name» is back in herdr as $T on session $sid ($model, $effort): type your next message there"
