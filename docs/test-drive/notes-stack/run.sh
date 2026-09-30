#!/usr/bin/env bash
# run.sh <lane: fs|cli>  — resets from pristine, runs the op batches, prints timings + correctness
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LANE="${1:?lane: fs|cli|obs}"
WORKDIR="${BENCH_DIR:?set BENCH_DIR to a scratch dir outside the repo}"
PRISTINE="$WORKDIR/pristine"; WORK="$WORKDIR/work"
CLI="${NOTESMD_CLI:-$(command -v notesmd-cli || echo "$HERE/notesmd-cli")}"
CLIHOME="$WORKDIR/clihome"          # isolated HOME so dima's obsidian.json is never touched
BATCH=50

# the vault root persists (obsidian may hold it open): contents reset, .obsidian kept
reset() { mkdir -p "$WORK"; rsync -a --delete --exclude .obsidian "$PRISTINE/" "$WORK/"; }
ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
targets() { find "$WORK/notes" -name '*.md' | sort | head -n "$BATCH"; }

nm() { # vault-relative note name without .md, as notesmd-cli wants
  local p="${1#"$WORK"/}"; echo "${p%.md}"
}
rp() { echo "${1#"$WORK"/}"; }   # vault-relative path with .md, as the official cli wants
OBS="timeout 10 obsidian vault=work"

echo "### lane=$LANE  batch=$BATCH"
reset

if [ "$LANE" = obs ]; then sleep 8; fi   # let the app re-index the reset vault before the first call
if [ "$LANE" = cli ]; then
  rm -rf "$CLIHOME"; mkdir -p "$CLIHOME"
  HOME="$CLIHOME" "$CLI" add-vault "$WORK" --set-default >/dev/null 2>&1 \
    || { echo "!! add-vault failed"; HOME="$CLIHOME" "$CLI" add-vault "$WORK" --set-default; }
  echo "vault registered under isolated HOME; dima's obsidian.json untouched:"
  ls "$CLIHOME/Library/Application Support/obsidian/" 2>/dev/null || ls -R "$CLIHOME" 2>/dev/null | head
fi

run_op() { # run_op <label> <count> <cmd...>
  local label="$1" count="$2"; shift 2
  if [ -n "${PAUSE:-}" ]; then echo ">> next: $label — watch now"; sleep "$PAUSE"; fi
  local t0 t1 dur out; out=$(mktemp)
  t0=$(ms); "$@" >"$out" 2>/dev/null; t1=$(ms)
  dur=$((t1-t0))
  printf "%-22s %6s ms  n=%-4s  %s ops/min  out=%s bytes\n" "$label" "$dur" "$count" \
    "$(python3 -c "print(round($count/max($dur,1)*60000))")" "$(wc -c <"$out" | tr -d ' ')"; rm -f "$out"
}

# ---------- OP1: read N notes ----------
op1_fs()  { targets | while read -r f; do cat "$f" >/dev/null; done; }
op1_obs() { targets | while read -r f; do $OBS read path="$(rp "$f")" </dev/null; done; }
op1_cli() { targets | while read -r f; do HOME="$CLIHOME" "$CLI" print "$(nm "$f")"; done; }

# ---------- OP2: append a line to N notes ----------
op2_fs()  { targets | while read -r f; do printf '\nappended by bench\n' >> "$f"; done; }
op2_obs() { targets | while read -r f; do $OBS append path="$(rp "$f")" content="appended by bench" </dev/null; done; }
op2_cli() { targets | while read -r f; do HOME="$CLIHOME" "$CLI" create "$(nm "$f")" --content "appended by bench" --append; done; }

# ---------- OP3: set a frontmatter key on N notes ----------
op3_fs()  { targets | while read -r f; do
              awk 'NR==1&&/^---/{print;fm=1;next} fm&&/^status:/{print "status: benched";next} fm&&/^---/{fm=0} {print}' "$f" > "$f.t" && mv "$f.t" "$f"
            done; }
op3_obs() { targets | while read -r f; do $OBS property:set path="$(rp "$f")" name=status value=benched </dev/null; done; }
op3_cli() { targets | while read -r f; do HOME="$CLIHOME" "$CLI" frontmatter "$(nm "$f")" --edit --key status --value benched; done; }

# ---------- OP4: rename the hub note (the link-integrity test) ----------
op4_fs()  { mv "$WORK/hub/Hub Target.md" "$WORK/hub/Hub Renamed.md"; }
op4_obs() { $OBS rename path="hub/Hub Target.md" name="Hub Renamed"; }
op4_cli() { HOME="$CLIHOME" "$CLI" move "hub/Hub Target" "hub/Hub Renamed"; }

# ---------- OP5: full-text search ----------
op5_fs()  { grep -rl 'anchor-one' "$WORK" --include='*.md'; }
op5_obs() { $OBS search query="anchor-one" format=json; }
op5_cli() { HOME="$CLIHOME" "$CLI" search-content 'anchor-one'; }

run_op "op1 read"        "$BATCH" "op1_$LANE"
run_op "op2 append"      "$BATCH" "op2_$LANE"
run_op "op3 frontmatter" "$BATCH" "op3_$LANE"
run_op "op4 rename hub"  1        "op4_$LANE"
run_op "op5 search"      1        "op5_$LANE"

echo "--- correctness after rename ---"
old=$(grep -rhoE '\[\[Hub Target[^]]*\]\]' "$WORK" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
new=$(grep -rhoE '\[\[Hub Renamed[^]]*\]\]' "$WORK" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
mdlink=$(grep -rhoE '\]\(hub/Hub%20Target\.md\)' "$WORK" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
total=$(grep -rhoE '!?\[\[Hub Target[^]]*\]\]' "$PRISTINE" --include='*.md' 2>/dev/null | wc -l | tr -d ' ')
echo "wikilinks still pointing at old name : $old   ($total = none rewritten, 0 = all rewritten)"
echo "wikilinks rewritten to new name      : $new"
echo "markdown-style links left stale      : $mdlink"
echo "frontmatter op correctness (status: benched count): $(grep -rc '^status: benched' "$WORK/notes" 2>/dev/null | grep -vc ':0' | tr -d ' ')"
nnotes=$(find "$WORK/notes" -name '*.md' | wc -l | tr -d ' ')
echo "files still parseable (fm fence pairs intact): $(find "$WORK/notes" -name '*.md' -exec sh -c 'head -1 "$1" | grep -q "^---$" && echo ok' _ {} \; | wc -l | tr -d ' ')/$nnotes"
