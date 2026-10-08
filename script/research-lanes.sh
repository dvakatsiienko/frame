#!/bin/sh
# runs the free research lanes on one brief, in parallel: an exa agent run and a parallel.ai core run.
# usage: pnpm research:lanes <brief.md> [out-dir] — the opus lane is an Agent the caller spawns beside it.
# writes <out>/exa.md and <out>/parallel.md, then prints one line per lane: status, seconds, chars, cost.
set -u
self=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")

if [ "${1:-}" = "--lane" ]; then
  lane=$2 brief=$3 out=$4 s=$(date +%s)
  case $lane in
    exa)
      body=$(jq -n --rawfile q "$brief" '{query: $q, effort: "medium"}')
      id=$(curl -s https://api.exa.ai/agent/runs -H "x-api-key: $EXA_API_KEY" -H 'Content-Type: application/json' -d "$body" | jq -r '.id // empty')
      [ -n "$id" ] || { echo "exa: create failed"; exit 1; }
      while :; do
        sleep 15
        curl -s "https://api.exa.ai/agent/runs/$id" -H "x-api-key: $EXA_API_KEY" > "$out/exa.json"
        case $(jq -r .status "$out/exa.json") in queued|running) ;; *) break ;; esac
      done
      jq -r '.output.text // ""' "$out/exa.json" > "$out/exa.md"
      echo "exa: $(jq -r .status "$out/exa.json") · $(( $(date +%s) - s )) s · $(wc -c < "$out/exa.md" | tr -d ' ') chars · \$$(jq -r '.costDollars.total // "?"' "$out/exa.json")"
      ;;
    parallel)
      parallel-cli research run --processor core --text -o "$out/parallel" -f "$brief" > "$out/parallel.log" 2>&1
      code=$?
      echo "parallel: exit $code · $(( $(date +%s) - s )) s · $(wc -c < "$out/parallel.md" 2>/dev/null | tr -d ' ') chars · ¢ unsettled"
      exit $code
      ;;
  esac
  exit 0
fi

brief=${1:?usage: research-lanes <brief.md> [out-dir]}
[ -s "$brief" ] || { echo "research-lanes: no brief at $brief" >&2; exit 1; }
# a recipe's lanes launch only after dima's word on today's groom (x:shape-recipe step 0)
brief_abs=$(cd "$(dirname "$brief")" && pwd)/$(basename "$brief")
case $brief_abs in
  */recipes/*/last/*)
    recipe=${brief_abs%%/last/*}
    groomed=$(awk 'NR > 1 && /^---$/ { exit } /^groomed:/ { print $2; exit }' "$recipe/recipe.md" 2>/dev/null)
    [ "$groomed" = "$(date +%F)" ] || {
      echo "research-lanes: recipe $(basename "$recipe") is groomed ${groomed:-never}, not today — groom it with dima first (x:shape-recipe step 0)" >&2
      exit 2
    }
    ;;
esac
out=${2:-$(dirname "$brief")/lanes-$(date +%H%M%S)}
mkdir -p "$out"
op="$(dirname "$self")/op-run.sh"
timeout 1200 "$op" "$self" --lane exa "$brief" "$out" > "$out/exa.status" 2>&1 &
exa=$!
timeout 900 "$op" "$self" --lane parallel "$brief" "$out" > "$out/parallel.status" 2>&1 &
par=$!
failed=0
wait $exa || failed=1
wait $par || failed=1
cat "$out/exa.status" "$out/parallel.status"
echo "out: $out"
# a fan-out that ran nothing must not read green: any failed lane fails the run
exit $failed
