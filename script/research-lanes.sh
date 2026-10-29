#!/bin/sh
# runs the free research lanes on one brief, in parallel: an exa agent run, a parallel.ai core run and a linkup research run (on trial).
# usage: pnpm research:lanes <brief.md> [out-dir] — the opus lane is an Agent the caller spawns beside it.
# writes <out>/exa.md, <out>/parallel.md and <out>/linkup.md, then prints one line per lane: status, seconds, chars, cost.
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
    linkup)
      # on trial: docs/test-drive/linkup.md — a lane with no key skips, it never fails the run
      [ -n "${LINKUP_API_KEY:-}" ] || { echo "linkup: skipped · no key in dev/linkup-golden"; exit 0; }
      linkup --json research -f "$brief" --reasoning-depth S --wait --timeout 1100 > "$out/linkup.json" 2> "$out/linkup.log"
      code=$?
      jq -r '.output.answer // .answer // .output // empty | if type == "string" then . else tojson end' "$out/linkup.json" > "$out/linkup.md" 2>> "$out/linkup.log"
      echo "linkup: exit $code · $(( $(date +%s) - s )) s · $(wc -c < "$out/linkup.md" | tr -d ' ') chars · \$0.25 (research S)"
      exit $code
      ;;
  esac
  exit 0
fi

brief=${1:?usage: research-lanes <brief.md> [out-dir]}
[ -s "$brief" ] || { echo "research-lanes: no brief at $brief" >&2; exit 1; }
# a recipe's lanes launch only after dima's word on today's groom (clio:shape-recipe step 0)
brief_abs=$(cd "$(dirname "$brief")" && pwd)/$(basename "$brief")
case $brief_abs in
  */recipes/*/last/*)
    name=${brief_abs##*/recipes/}
    recipe=${brief_abs%/recipes/*}/recipes/${name%%/*}
    groomed=$(awk 'NR > 1 && /^---$/ { exit } /^groomed:/ { sub(/^groomed:[ \t]*/, ""); sub(/\r$/, ""); sub(/[ \t]+#.*$/, ""); sub(/[ \t]+$/, ""); gsub(/["'\''`]/, ""); print; exit }' "$recipe/recipe.md" 2>/dev/null)
    [ "$groomed" = "$(date +%F) (dima)" ] || {
      echo "research-lanes: recipe $(basename "$recipe") is groomed ${groomed:-never}, not today — groom it with dima first (clio:shape-recipe step 0)" >&2
      exit 2
    }
    # the shared vectors ride every recipe brief, built by recipe:brief and marked with their hash (dima o73)
    grep -Eq '^<!-- shared-vectors: [0-9a-f]{64} -->$' "$brief" || {
      echo "research-lanes: $brief carries no shared vectors — build it with pnpm recipe:brief ${name%%/*}" >&2
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
timeout 1200 "$op" "$self" --lane linkup "$brief" "$out" > "$out/linkup.status" 2>&1 &
lnk=$!
failed=0
wait $exa || failed=1
wait $par || failed=1
wait $lnk || failed=1
cat "$out/exa.status" "$out/parallel.status" "$out/linkup.status"
echo "out: $out"
# a fan-out that ran nothing must not read green: any failed lane fails the run
exit $failed
