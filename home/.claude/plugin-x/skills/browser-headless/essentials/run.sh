#!/usr/bin/env bash
# the whole essentials pass for one view in one command: essentials.js and the tab walk at 1280 and 390,
# the page scrolled back to the top between them, console and page errors counted. one summary line; exit 1 on
# any fail, flag or error.
# usage: run.sh <url> [--wait <css selector>] [--deny <css selector>] [--allow <check>=<regex>]... [--max N]
#   --wait   what the page shows once its data landed (speak: '[data-engine]'); without it the checks can run on a
#            half-rendered page after the load event, and a 390 «covered» flaked that way
#   --deny   the app's own tab-walk opt-outs, passed to tab-walk.sh (atelier: '[role=separator]')
#   --allow  a known baseline fail: an item of <check> matching <regex> is suppressed and counted, never hidden.
#            <check> is an essentials.js check or `tab` for a tab-walk flag
#            (a page-level sticky save bar: --allow 'covered=footer'; chords' n cap: --allow 'cursor=Notion')
# uses $AGENT_BROWSER_SESSION when set; otherwise opens its own session and closes it at the end.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
url=''
deny=''
wait_for=''
max=200
allows=()
while [ $# -gt 0 ]; do
  case "$1" in
    --deny) deny="$2"; shift 2 ;;
    --wait) wait_for="$2"; shift 2 ;;
    --allow) allows+=("$2"); shift 2 ;;
    --max) max="$2"; shift 2 ;;
    -*) echo "unknown arg: $1" >&2; exit 2 ;;
    *) url="$1"; shift ;;
  esac
done
[ -n "$url" ] || { echo "usage: run.sh <url> [--wait <selector>] [--deny <selector>] [--allow <check>=<regex>]... [--max N]" >&2; exit 2; }

own=0
if [ -z "${AGENT_BROWSER_SESSION:-}" ]; then
  AGENT_BROWSER_SESSION="essentials-$$"
  own=1
fi
export AGENT_BROWSER_SESSION
trap '[ "$own" = 1 ] && agent-browser close >/dev/null 2>&1 || true' EXIT

allow_json=$(printf '%s\n' "${allows[@]+"${allows[@]}"}" | jq -Rs 'split("\n") | map(select(length > 0) | capture("^(?<check>[^=]+)=(?<pattern>.*)$"))')
tab_args=(--max "$max")
[ -n "$deny" ] && tab_args+=(--deny "$deny")

agent-browser open "$url" >/dev/null
agent-browser wait --load load >/dev/null
agent-browser console --clear >/dev/null
agent-browser errors --clear >/dev/null

status=0
parts=()
details=()
for size in '1280 800' '390 844'; do
  width=${size%% *}
  agent-browser set viewport $size >/dev/null
  agent-browser open "$url" >/dev/null
  agent-browser wait --load load >/dev/null
  [ -n "$wait_for" ] && agent-browser wait "$wait_for" >/dev/null

  report=$(agent-browser eval "$(cat "$here/essentials.js")" | jq --argjson allow "$allow_json" '
    .fail as $fail
    | ($fail | to_entries | map(.key as $check | .value as $items
        | ($allow | map(select(.check == $check) | .pattern)) as $patterns
        | { check: $check,
            kept: [$items[] | select(. as $item | $patterns | any(. as $p | $item | test($p)) | not)],
            allowed: [$items[] | select(. as $item | $patterns | any(. as $p | $item | test($p)))] })) as $sorted
    | { pass: (.pass | length),
        fail: [$sorted[] | select(.kept | length > 0)],
        baseline: ([$sorted[] | .allowed | length] | add // 0) }')

  agent-browser eval '(() => { scrollTo(0, 0); return 1; })()' >/dev/null
  walk=$("$here/tab-walk.sh" "${tab_args[@]}" | jq --argjson allow "$allow_json" '
    ($allow | map(select(.check == "tab") | .pattern)) as $patterns
    | .allowed = ([.flags[] | select(. as $flag | $patterns | any(. as $p | $flag | test($p)))] | length)
    | .flags = [.flags[] | select(. as $flag | $patterns | any(. as $p | $flag | test($p)) | not)]')
  agent-browser eval '(() => { scrollTo(0, 0); return 1; })()' >/dev/null

  fails=$(jq '.fail | length' <<<"$report")
  flags=$(jq '.flags | length' <<<"$walk")
  line="$width: $(jq -r '.pass' <<<"$report") pass · $fails fail"
  [ "$(jq '.baseline' <<<"$report")" != 0 ] && line+=" ($(jq '.baseline' <<<"$report") allowed)"
  line+=" · tab $(jq '.stops' <<<"$walk") stops, $flags flags"
  [ "$(jq '.allowed' <<<"$walk")" != 0 ] && line+=" ($(jq '.allowed' <<<"$walk") allowed)"
  [ "$(jq '.capped' <<<"$walk")" = true ] && line+=" (capped)"
  parts+=("$line")
  [ "$fails" != 0 ] && { status=1; details+=("$(jq -r --arg w "$width" '.fail[] | "  \($w) \(.check): \(.kept | join(" | "))"' <<<"$report")"); }
  [ "$flags" != 0 ] && { status=1; details+=("$(jq -r --arg w "$width" '.flags[] | "  \($w) tab: \(.)"' <<<"$walk")"); }
done

console=$(agent-browser console --json | jq '[.data.messages[]? | select(.type == "error")] | length')
page=$(agent-browser errors --json | jq '.data.errors // [] | length')
errors=$((console + page))
[ "$errors" != 0 ] && { status=1; details+=("  console: $(agent-browser console --json | jq -r '[.data.messages[]? | select(.type == "error") | .text[0:80]] | join(" | ")') $(agent-browser errors --json | jq -r '[.data.errors[]?.text[0:80]] | join(" | ")')"); }

[ ${#details[@]} -gt 0 ] && printf '%s\n' "${details[@]}"
echo "$([ "$status" = 0 ] && echo ✅ || echo 🔴) essentials $url — ${parts[0]} | ${parts[1]} | errors $errors"
exit "$status"
