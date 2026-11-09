#!/bin/bash
# FRM-536: the timed go suites only, whole tree already in place on both sides; timing to its own file
set -u
S=${S:-${TMPDIR:-/tmp}/linux-vm}; mkdir -p "$S"
out=$S/vm-round3.tsv
: >"$out"
vm() { limactl shell frm536 -- bash -lc "export PATH=\$HOME/node/bin:\$HOME/go-dl/go/bin:\$PATH GOFLAGS=-buildvcs=false GIT_CONFIG_GLOBAL=/dev/null CI=1; $1"; }
for round in 1 2; do
    vm 'cd ~/whole/x/go && /usr/bin/time -f "%e wall %U user %S sys" -o /tmp/t.txt go test -count=1 -parallel 5 ./... >/tmp/suite.out 2>&1; echo "$(cat /tmp/t.txt) ok=$(grep -c "^ok" /tmp/suite.out) fails=$(grep -c "^--- FAIL" /tmp/suite.out)"' | sed "s/^/vm\t$round\t/" >>"$out"
    (cd "$S/macwhole/x/go" && GIT_CONFIG_GLOBAL=/dev/null GOFLAGS=-buildvcs=false /usr/bin/time -p go test -count=1 -parallel 5 ./... >"$S/macwhole.out" 2>"$S/mactime.txt"
        echo -e "mac\t$round\t$(grep -E '^(real|user|sys) ' "$S/mactime.txt" | tr '\n' ' ') ok=$(grep -c '^ok' "$S/macwhole.out") fails=$(grep -c '^--- FAIL' "$S/macwhole.out")") >>"$out"
    echo -e "load\t$round\t$(uptime)" >>"$out"
done
echo done
