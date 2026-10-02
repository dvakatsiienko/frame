#!/bin/bash
# research-stale — every docs/research/ doc whose named tickets are all closed, or that names none.
# reads only the frontmatter lines (dies-when, Ticket) plus one linear query; the halt runs it and
# each hit joins the flush proposal: delete, distill, or rewrite its dies-when (dima's call).
# macos bash 3.2: no associative arrays, so the files are read twice.
set -eu
DIR="$HOME/frame/docs/research"
field() { head -8 "$1" | grep -i -m1 "^$2:" | cut -d: -f2- | sed 's/^ *//' || true; }
ids() { field "$1" ticket | grep -oE '(FRM|DOT|BYT)-[0-9]+' || true; }

query="query {"
for id in $(for f in "$DIR"/*.md; do ids "$f"; done | sort -u); do
  query+=" ${id//-/_}: issue(id: \"$id\") { state { name type } }"
done
states=$(cd "$HOME/frame" && linear api "$query query_end: viewer { id } }" 2>/dev/null) || { echo "🚨 FAIL · research-stale: linear unreachable"; exit 1; }

hits=0 total=0
for f in "$DIR"/*.md; do
  total=$((total + 1)); name=$(basename "$f"); dies=$(field "$f" dies-when)
  list=$(ids "$f")
  # `Ticket: none` is the repo rule for a doc no ticket owns: its dies-when alone retires it
  if [ -z "$list" ] && [ "$(field "$f" ticket)" = none ]; then continue; fi
  if [ -z "$list" ]; then echo "⚠️ $name — no Ticket line · dies-when: ${dies:-none}"; hits=$((hits + 1)); continue; fi
  open=0 line=""
  for id in $list; do
    st=$(jq -r --arg k "${id//-/_}" '.data[$k] | "\(.state.name)|\(.state.type)"' <<<"$states")
    case "$st" in *"|completed"|*"|canceled") ;; *) open=1 ;; esac
    line+="$id ${st%%|*} · "
  done
  [ "$open" = 1 ] && continue
  echo "🗑️ $name — ${line}dies-when: ${dies:-none}"
  hits=$((hits + 1))
done
echo "research-stale: ${hits} of ${total} docs past their tickets"
