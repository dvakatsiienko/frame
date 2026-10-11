#!/bin/zsh
# refuses a ✅ line that carries no bytes before → after or misses a lens verdict (the 10-11 run passed 27 files «unchanged»).
# usage: groom-list-check.sh [groom-list.md] — exit 1 names every bad line
set -u
L=${1:-$(dirname $0)/../last/groom-list.md}
lenses=(dupe superseded enforced unused no-op altitude trim merge placement deferral protected)
bad=0
while IFS= read -r line; do
  miss=()
  [[ $line =~ '[0-9,]+ → [0-9,]+ B' ]] || miss+=(bytes)
  [[ $line == *'lenses:'* ]] || miss+=(lenses:)
  for l in $lenses; do [[ $line == *"$l"* ]] || miss+=($l); done
  if (( ${#miss} )); then
    print -r -- "✗ ${line[1,90]} — missing: ${(j:, :)miss}"
    bad=1
  fi
done < <(grep '^- ✅' $L)
(( bad )) && exit 1
print "groom list: every ✅ carries bytes and all ${#lenses} lens verdicts"
