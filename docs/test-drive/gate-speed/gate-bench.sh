#!/bin/zsh
# gate-bench: wall, cpu and peak rss per gate, one at a time, from wing 1's tree. reads only; temp output in the scratchpad.
out=${GATE_SPEED_DIR:?a dir for the bench output}
mkdir -p "$out"
tree=$(git rev-parse --show-toplevel)
cd "$tree" || exit 1

run() {
    local name=$1; shift
    echo "== $name load=$(sysctl -n vm.loadavg)"
    /usr/bin/time -l "$@" >"$out/$name.out" 2>"$out/$name.time"
    local code=$?
    awk -v n="$name" -v c="$code" '/ real / {printf "%s exit=%s real=%s user=%s sys=%s cpu/wall=%.1f", n, c, $1, $3, $5, ($3+$5)/($1>0?$1:1)} /maximum resident/ {printf " peakMB=%d", $1/1048576} END {print ""}' "$out/$name.time"
}

run index-copy script/index-run.sh true
run vitest-default pnpm exec vitest run --reporter=json --outputFile="$out/vitest.json"
run vitest-4workers pnpm exec vitest run --maxWorkers=4 --minWorkers=1
run vitest-threads pnpm exec vitest run --pool=threads
run tsc-root pnpm exec tsc --noEmit
run tsc-incremental-1 pnpm exec tsc --noEmit --incremental --tsBuildInfoFile "$out/root.tsbuildinfo"
run tsc-incremental-2 pnpm exec tsc --noEmit --incremental --tsBuildInfoFile "$out/root.tsbuildinfo"
run typecheck-all pnpm typecheck
run go-test-cached go -C x/go test ./...
run go-test-count1 go -C x/go test -count=1 ./...
run go-test-p4 go -C x/go test -count=1 -p 4 -parallel 4 ./...
run go-vet go -C x/go vet ./...
echo "== done load=$(sysctl -n vm.loadavg)"
