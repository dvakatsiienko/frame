#!/usr/bin/env bash
# rest_lane.sh — the obsidian local-rest-api lane (every obsidian mcp server wraps this api)
# needs OBS_KEY in env (never on disk), BENCH_DIR, the plugin enabled in the open vault
set -uo pipefail
WORKDIR="${BENCH_DIR:?}"; PRISTINE="$WORKDIR/pristine"; WORK="$WORKDIR/work"
KEY="${OBS_KEY:?export OBS_KEY}"; API=https://127.0.0.1:27124; BATCH=50
c() { curl -sk --max-time 10 -H "Authorization: Bearer $KEY" "$@"; }
ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
targets() { find "$WORK/notes" -name '*.md' | sort | head -n "$BATCH"; }
rp() { echo "${1#"$WORK"/}"; }
enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1], safe="/"))' "$1"; }   # %2F answers 404; keep the slash
run_op() { local label="$1" count="$2"; shift 2
  if [ -n "${PAUSE:-}" ]; then echo ">> next: $label — watch now"; sleep "$PAUSE"; fi
  local t0 t1 dur out; out=$(mktemp); t0=$(ms); "$@" >"$out" 2>/dev/null; t1=$(ms); dur=$((t1-t0))
  printf "%-22s %6s ms  n=%-4s  %s ops/min  out=%s bytes\n" "$label" "$dur" "$count" "$(python3 -c "print(round($count/max($dur,1)*60000))")" "$(wc -c <"$out" | tr -d ' ')"; rm -f "$out"; }
echo "### lane=rest  batch=$BATCH"
mkdir -p "$WORK"; rsync -a --delete --exclude .obsidian "$PRISTINE/" "$WORK/"; sleep 8
op1() { targets | while read -r f; do c "$API/vault/$(enc "$(rp "$f")")"; done; }
op2() { targets | while read -r f; do c -X POST -H 'Content-Type: text/markdown' --data-binary $'\nappended by bench\n' "$API/vault/$(enc "$(rp "$f")")"; done; }
op3() { targets | while read -r f; do c -X PATCH -H 'Operation: replace' -H 'Content-Type: application/json' -d '"benched"' "$API/vault/$(enc "$(rp "$f")")/frontmatter/status"; done; }
op4() { # no rename endpoint exists: read + put + delete, the api cannot rewrite links
  local body; body=$(c "$API/vault/hub/Hub%20Target.md"); c -X PUT -H 'Content-Type: text/markdown' --data-binary "$body" "$API/vault/hub/Hub%20Renamed.md"; c -X DELETE "$API/vault/hub/Hub%20Target.md"; }
op5() { c -X POST "$API/search/simple/?query=anchor-one"; }
run_op "op1 read" "$BATCH" op1; run_op "op2 append" "$BATCH" op2; run_op "op3 frontmatter" "$BATCH" op3; run_op "op4 rename hub" 1 op4; run_op "op5 search" 1 op5
sleep 3
echo "--- correctness ---"
echo "appended: $(grep -l 'appended by bench' "$WORK"/notes/*.md | wc -l | tr -d ' ')/50   benched: $(grep -l '^status: benched' "$WORK"/notes/*.md | wc -l | tr -d ' ')/50"
echo "wikilinks still pointing at old name : $(grep -rhoE '\[\[Hub Target[^]]*\]\]' "$WORK" --include='*.md' | wc -l | tr -d ' ')   hub files: $(ls "$WORK/hub")"
