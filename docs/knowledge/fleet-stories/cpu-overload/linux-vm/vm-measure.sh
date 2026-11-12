#!/bin/bash
# FRM-536: the 2,000-spawn program and one go suite, in the lima vm (checkout on its own disk) and on macos
set -u
S=${S:-${TMPDIR:-/tmp}/linux-vm}; mkdir -p "$S"
B=~/frame/docs/knowledge/fleet-stories/cpu-overload/git-process-cost/spawn-bench
out=$S/vm-measure.tsv
: >"$out"

# the vm: go matching the host, git, both trees copied onto the vm's own disk
limactl shell frm536 -- bash -c 'set -e
  rm -rf ~/go-dl && mkdir ~/go-dl
  curl -fsSL https://go.dev/dl/go1.27.3.linux-arm64.tar.gz | tar -C ~/go-dl -xz
  command -v git >/dev/null || (sudo apt-get update -qq && sudo apt-get install -y -qq git >/dev/null)
  rm -rf ~/work && mkdir -p ~/work'
tar -C "$B/.." -cf - spawn-bench | limactl shell frm536 -- tar -C '~/work' -xf - 2>/dev/null ||
    tar -C "$B/.." -cf - spawn-bench | limactl shell frm536 -- bash -c 'tar -C ~/work -xf -'
git -C ~/frame archive HEAD x/go | limactl shell frm536 -- bash -c 'tar -C ~/work -xf -'

vm() { limactl shell frm536 -- bash -lc "export PATH=\$HOME/go-dl/go/bin:\$PATH GOFLAGS=-buildvcs=false GIT_CONFIG_GLOBAL=/dev/null; $1"; }
vm 'cd ~/work/spawn-bench && sed -i "s#/opt/homebrew/bin/git#/usr/bin/git#" main.go && go build -o sb . && git config --global user.email t@t 2>/dev/null; true'
(cd "$B" && go build -o "$S/sb-mac" .)

for round in 1 2; do
    for w in 1 10; do
        echo -e "vm\tspawn\tw$w\t$(vm "~/work/spawn-bench/sb std 2000 $w" 2>&1 | tail -1)" >>"$out"
        echo -e "mac\tspawn\tw$w\t$("$S/sb-mac" std 2000 "$w" 2>&1 | tail -1)" >>"$out"
    done
done

# one go suite each side, -parallel 5 like the budget script, user+sys and wall
vm 'cd ~/work/x/go && go test -count=1 -run XXX . >/dev/null 2>&1'
echo -e "vm\tsuite\t$(vm 'cd ~/work/x/go && { /usr/bin/time -f "%e wall %U user %S sys" go test -count=1 -parallel 5 ./... >/tmp/suite.out 2>&1; } 2>&1; tail -1 /tmp/suite.out')" >>"$out"
mkdir -p "$S/macsuite" && git -C ~/frame archive HEAD x/go | tar -C "$S/macsuite" -xf -
(cd "$S/macsuite/x/go" && go test -count=1 -run XXX . >/dev/null 2>&1)
echo -e "mac\tsuite\t$(cd "$S/macsuite/x/go" && { /usr/bin/time -p env GIT_CONFIG_GLOBAL=/dev/null go test -count=1 -parallel 5 ./... >"$S/macsuite.out" 2>&1; } 2>&1 | tr '\n' ' '; tail -1 "$S/macsuite.out")" >>"$out"
echo -e "load\t$(uptime)" >>"$out"
echo done
