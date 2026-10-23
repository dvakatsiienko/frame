#!/bin/sh
# the stacks-built-out pass of `pnpm x-go:test`: the build, the vet and every lane-verb test with the
# add-on out — the proof plain prs run without it (FRM-422, W4). the rest of the suite never meets the seam
set -eu
cd "$(dirname "$0")"
files="lane_test.go lane_gate_test.go lane_stdin_test.go merge_auto_test.go merge_test.go rebase_main_test.go
decamp_test.go seed_test.go verify_tree_test.go review_test.go stacks_off_test.go"
for f in $files; do
	[ -f "$f" ] || { echo "nostacks pass: $f is gone — name its successor in $0" >&2; exit 1; }
done
# shellcheck disable=SC2086
tests=$(sed -n 's/^func \(Test[A-Za-z0-9_]*\)(t \*testing\.T).*/\1/p' $files | paste -sd'|' -)
[ -n "$tests" ] || { echo "nostacks pass: no test found in its files" >&2; exit 1; }
go build -tags nostacks -o /dev/null .
go vet -tags nostacks ./...
echo "nostacks pass: $(echo "$tests" | tr '|' '\n' | wc -l | tr -d ' ') tests"
GIT_CONFIG_GLOBAL=/dev/null go test -tags nostacks -run "^($tests)\$" ./...
