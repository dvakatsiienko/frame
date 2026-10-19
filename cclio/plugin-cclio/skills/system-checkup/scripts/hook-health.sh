#!/usr/bin/env bash
# hook latency and errors per hook, from the local OTel tap (schedule/jobs/x-cc-otel). usage: hook-health.sh [days=7]
set -euo pipefail
days="${1:-7}"
dir="$HOME/.local/share/x-cc-otel"
files=$(ls -t "$dir"/*.jsonl 2>/dev/null | head -n "$days")
[ -n "$files" ] || { echo "hook-health: no telemetry in $dir — is the x-cc-otel tap running?"; exit 1; }
# shellcheck disable=SC2086
jq -c '.. | objects | select(has("logRecords")) | .logRecords[]
  | ([.attributes[] | {(.key): (.value | to_entries[0].value)}] | add)
  | select(."event.name" == "hook_execution_complete")
  | {name: .hook_name, ms: (.total_duration_ms | tonumber), err: (.num_non_blocking_error | tonumber), cancel: (.num_cancelled | tonumber)}' $files \
| jq -rs --arg days "$days" '
  def pct(p): sort | .[((length - 1) * p | floor)];
  group_by(.name) | map({name: .[0].name, n: length, p50: (map(.ms) | pct(0.5)), p95: (map(.ms) | pct(0.95)), max: (map(.ms) | max),
    err: (map(.err) | add), cancel: (map(.cancel) | add)}) | sort_by(-.p95)
  | "hook-health · last \($days) day files · \(map(.n) | add) runs",
    (map(. + {mark: (if .p95 > 1000 or .err > 0 or .cancel > 0 then "🔴" elif .p95 > 300 then "🟡" else "🟢" end)}) as $rows
     | ($rows[] | select(.mark != "🟢") | "\(.mark) \(.name) · n \(.n) · p50 \(.p50) ms · p95 \(.p95) ms · max \(.max) ms · errors \(.err) · cancelled \(.cancel)"),
       "🟢 \($rows | map(select(.mark == "🟢")) | length) hooks under 300 ms p95, no errors")'
