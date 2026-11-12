#!/bin/bash
export LANG=en_US.UTF-8
brew=/opt/homebrew/bin/git
slim="$HOME/.local/state/x/lanes/frm-525/slim-git/out/bin/git"
clt=/Library/Developer/CommandLineTools/usr/bin/git
scratch=$(mktemp -d "${TMPDIR:-/tmp}/slim-time.XXXX")
trap 'rm -rf "$scratch"' EXIT

images() {
    DYLD_PRINT_LIBRARIES=1 "$1" --version 2>&1 | grep -c 'dyld\['
}
echo "images: brew $(images "$brew"), slim $(images "$slim"), clt $(images "$clt")"
"$slim" --version
otool -L "$slim" | cut -c1-90

# user + sys ms per run of 200 in a child shell
per_start() {
    local label=$1
    shift
    local out
    out=$( { /usr/bin/time -p bash -c 'for i in {1..200}; do "$@" >/dev/null 2>&1; done' _ "$@"; } 2>&1 )
    echo "$out" | awk -v l="$label" '/^real/ {r=$2} /^user/ {u=$2} /^sys/ {s=$2} END {printf "%s cpu=%.2fms wall=%.2fms\n", l, (u+s)*5, r*5}'
}

for g in brew slim clt slim brew clt; do
    case $g in brew) b=$brew ;; slim) b=$slim ;; clt) b=$clt ;; esac
    per_start "version $g" "$b" --version
done

"$brew" init -q "$scratch/r"
"$brew" -C "$scratch/r" -c user.name=t -c user.email=t@t commit -q --allow-empty -m one
for g in brew slim brew slim; do
    case $g in brew) b=$brew ;; slim) b=$slim ;; esac
    per_start "rev-parse $g" "$b" -C "$scratch/r" rev-parse HEAD
done

echo "sanity, slim does a real push:"
"$slim" init -q --bare "$scratch/o.git"
"$slim" init -q "$scratch/w"
"$slim" -C "$scratch/w" -c user.name=t -c user.email=t@t commit -q --allow-empty -m one
"$slim" -C "$scratch/w" push -q "$scratch/o.git" HEAD:refs/heads/main
echo "push exit $?"
"$slim" -C "$scratch/o.git" log --oneline -1 main
