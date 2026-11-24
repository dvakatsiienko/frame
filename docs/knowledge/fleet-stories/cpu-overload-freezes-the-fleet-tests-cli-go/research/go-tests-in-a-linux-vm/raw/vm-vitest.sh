#!/bin/bash
# FRM-536 follow-up for dima's o12: the vitest suite, vm against mac, same whole-tree copies as round 2
set -u
S=${S:-${TMPDIR:-/tmp}/linux-vm}; mkdir -p "$S"
out=$S/vm-vitest.tsv
: >"$out"
vm() { limactl shell frm536 -- bash -lc "export PATH=\$HOME/node/bin:\$HOME/go-dl/go/bin:\$PATH GIT_CONFIG_GLOBAL=/dev/null CI=1; $1"; }
for round in 1 2; do
    vm 'cd ~/whole && /usr/bin/time -f "%e wall %U user %S sys" -o /tmp/vt.txt pnpm exec vitest run >/tmp/vitest.out 2>&1; echo "$(cat /tmp/vt.txt) $(grep -E "Tests +[0-9]" /tmp/vitest.out | tail -1)"' | sed "s/^/vm\t$round\t/" >>"$out"
    (cd "$S/macwhole" && GIT_CONFIG_GLOBAL=/dev/null CI=1 /usr/bin/time -p pnpm exec vitest run >"$S/macvitest.out" 2>"$S/macvt.txt"
        echo -e "mac\t$round\t$(grep -E '^(real|user|sys) ' "$S/macvt.txt" | tr '\n' ' ') $(grep -E 'Tests +[0-9]' "$S/macvitest.out" | tail -1)") >>"$out"
    echo -e "load\t$round\t$(uptime)" >>"$out"
done
echo done
