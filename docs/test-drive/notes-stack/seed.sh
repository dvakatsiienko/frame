#!/usr/bin/env bash
# seed.sh <outdir> <n_notes>
# builds a pristine throwaway vault carrying the branch-1 "tricky parts" inventory
set -euo pipefail
OUT="${1:?outdir}"; N="${2:-300}"
rm -rf "$OUT"; mkdir -p "$OUT/notes" "$OUT/hub" "$OUT/daily" "$OUT/attachments"

# the hub note — the rename target. many notes link to it in every link form.
cat > "$OUT/hub/Hub Target.md" <<'EOF'
---
aliases: [Hub, HubAlias]
tags: [hub, bench]
status: active
---
# Hub Target

Anchor paragraph one. ^anchor-one

## Section A
Content under section A.

## Section B
Content under section B. ^anchor-two
EOF

lorem() { # $1 = repetitions
  local i; for ((i=0;i<$1;i++)); do
    echo "Body line $i with some filler text that makes the note a realistic size for measurement purposes."
  done
}

for ((i=1;i<=N;i++)); do
  # size buckets: 60% small, 30% medium, 10% large
  if   (( i % 10 == 0 )); then reps=140   # ~15KB
  elif (( i % 10 <= 3 )); then reps=28    # ~3KB
  else reps=4                             # ~0.5KB
  fi

  f="$OUT/notes/note-$(printf '%04d' "$i").md"
  {
    echo '---'
    echo "title: Note $i"
    echo "tags: [bench, batch/$((i % 7))]"
    echo "aliases: [n$i]"
    echo "created: 2026-09-0$((i % 9 + 1))"
    echo "status: $( ((i%3==0)) && echo done || echo open )"
    echo '---'
    echo
    echo "# Note $i"
    echo

    # --- tricky parts, distributed across the corpus ---
    case $((i % 8)) in
      0) echo "Plain wikilink to [[Hub Target]]." ;;
      1) echo "Aliased wikilink to [[Hub Target|the hub]]." ;;
      2) echo "Heading link to [[Hub Target#Section A]]." ;;
      3) echo "Block link to [[Hub Target#^anchor-one]]." ;;
      4) echo "Embed of the hub: ![[Hub Target]]" ;;
      5) echo "Embed of a section: ![[Hub Target#Section B]]" ;;
      6) echo "Markdown-style link: [the hub](hub/Hub%20Target.md)." ;;
      7) echo "Sibling link to [[note-$(printf '%04d' $(( (i % N) + 1 )))]]." ;;
    esac

    (( i % 5 == 0 )) && { echo; echo '> [!note] A callout'; echo '> callout body'; }
    (( i % 6 == 0 )) && { echo; echo '- [ ] an open task'; echo '- [x] a done task'; }
    (( i % 9 == 0 )) && { echo; echo 'inline-field:: value'; }
    (( i % 11 == 0 )) && { echo; echo '```dataview'; echo 'LIST FROM #bench'; echo '```'; }
    (( i % 13 == 0 )) && { echo; echo 'A footnote ref[^1]'; echo; echo '[^1]: the footnote body'; }
    (( i % 17 == 0 )) && { echo; echo 'An unresolved link to [[Does Not Exist]].'; }
    (( i % 19 == 0 )) && { echo; echo '| a | b |'; echo '| --- | --- |'; echo '| 1 | 2 |'; }

    echo; echo "Inline tag #bench-tag and a nested one #area/bench."
    echo
    lorem "$reps"
  } > "$f"
done

# daily notes
for d in 01 02 03 04 05; do
  printf -- "---\ndate: 2026-09-%s\n---\n\n# 2026-09-%s\n\n- [ ] daily task\nLink: [[Hub Target]]\n" "$d" "$d" > "$OUT/daily/2026-09-$d.md"
done

echo "seeded: $(find "$OUT" -name '*.md' | wc -l | tr -d ' ') notes, $(du -sh "$OUT" | cut -f1)"
echo "inbound links to Hub Target: $(grep -rlE '\[\[Hub Target' "$OUT" --include='*.md' | wc -l | tr -d ' ') files, $(grep -rhoE '\[\[Hub Target[^]]*\]\]' "$OUT" --include='*.md' | wc -l | tr -d ' ') link instances"
