#!/usr/bin/env bash
# ntn_lane.sh <parent-page-id> — notion's official cli, same op shapes as notion_lane.py, sequential
# (one process per call, like the obsidian cli lane). needs NOTION_API_TOKEN in env.
set -uo pipefail
PARENT="${1:?parent page id}"; N="${2:-50}"
ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
run_op() { local label="$1" count="$2"; shift 2
  if [ -n "${PAUSE:-}" ]; then echo ">> next: $label — watch now"; sleep "$PAUSE"; fi
  local t0 t1 dur out; out=$(mktemp); t0=$(ms); "$@" >"$out" 2>/dev/null; t1=$(ms); dur=$((t1-t0))
  printf "%-22s %6s ms  n=%-4s  %s ops/min  out=%s bytes\n" "$label" "$dur" "$count" "$(python3 -c "print(round($count/max($dur,1)*60000))")" "$(wc -c <"$out" | tr -d ' ')"; rm -f "$out"; }
echo "### lane=ntn  n=$N  parent=$PARENT"
if [ "${REUSE:-}" = 1 ] && [ -s /tmp/notes-stack-bench/ntn-ids.txt ]; then
  IDS=(); while read -r l; do IDS+=("$l"); done < /tmp/notes-stack-bench/ntn-ids.txt; HUB="${HUB:?export HUB when REUSE=1}"; echo "reusing ${#IDS[@]} ids, hub $HUB"
else
HUB=$(ntn pages create --parent "page:$PARENT" --content $'# Hub Target (ntn)\n\nAnchor paragraph one.\n\n## Section A\nContent under section A.' --json 2>/dev/null | jq -r '.id')
echo "hub: $HUB"
IDS=()
seed() { local i; for i in $(seq 1 "$N"); do IDS+=("$(ntn pages create --parent "page:$PARENT" --content "# ntn-note-$(printf '%04d' "$i")

Link to the hub — see [Hub Target (ntn)](https://www.notion.so/${HUB//-/}). Body line filler. Body line filler." --json 2>/dev/null | jq -r '.id')"); done; }
run_op "seed children" "$N" seed
printf '%s\n' "${IDS[@]}" > /tmp/notes-stack-bench/ntn-ids.txt
echo "created $(grep -c . /tmp/notes-stack-bench/ntn-ids.txt)/$N"
fi
op1() { local i; for i in "${IDS[@]}"; do ntn pages get "$i" </dev/null; done; }
op2() { local i; for i in "${IDS[@]}"; do ntn api "/v1/pages/$i/markdown" -X PATCH --notion-version 2026-03-11 -d '{"type":"insert_content","insert_content":{"content":"\nappended by bench\n","position":{"type":"end"}}}' </dev/null; done; }
op3() { local i; for i in "${IDS[@]}"; do ntn api "/v1/pages/$i" -X PATCH -d '{"properties":{"title":{"title":[{"text":{"content":"benched"}}]}}}' </dev/null; done; }
op4() { ntn api "/v1/pages/$HUB" -X PATCH -d '{"properties":{"title":{"title":[{"text":{"content":"Hub Renamed (ntn)"}}]}}}' </dev/null; }
op5() { ntn api "/v1/search" -X POST -d '{"query":"anchor"}' </dev/null; }
run_op "op1 read" "$N" op1; run_op "op2 append" "$N" op2; run_op "op3 title update" "$N" op3; run_op "op4 rename hub" 1 op4; run_op "op5 search" 1 op5
echo "--- correctness ---"
echo "appended: $(for i in "${IDS[@]:0:5}"; do ntn pages get "$i" 2>/dev/null | grep -c 'appended by bench'; done | paste -sd+ - | bc)/5 sampled"
echo "hub title now: $(ntn api "/v1/pages/$HUB" </dev/null 2>/dev/null | jq -r '.properties.title.title[0].plain_text')"
