#!/bin/zsh
# does rules/code.md load on touching a .py, .sh, .go, .tsx file, and stay out on a .txt? sonnet, one run per arm.
set -u
D=$(mktemp -d /private/tmp/claude-501/code-probe.XXXX)
cd "$D" && git init -q
print 'print(1)' > a.py; print 'echo 1' > a.sh; print 'package main' > a.go; print 'export const a = 1' > a.tsx; print 'plain' > a.txt
for f in a.txt a.py a.sh a.go a.tsx; do
  out=$(claude -p --model claude-sonnet-5-5 --permission-mode bypassPermissions "Use Bash to run: cat $f. Then answer on one line only: YES if your context now holds a rule saying tautological tests are disallowed, else NO." </dev/null 2>&1 | tail -1 | cut -c1-80)
  print "$f: $out"
done
