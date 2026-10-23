#!/bin/sh
# the stacks-built-out pass of `pnpm x-go:test`: build, vet and every test in a file that runs a lane verb,
# with the add-on out — the proof plain prs run without it; the rest of the suite never meets the seam
set -eu
cd "$(dirname "$0")"
# shellcheck disable=SC2046
tests=$(sed -n 's/^func \(Test[A-Za-z0-9_]*\)(t \*testing\.T).*/\1/p' $(grep -l '"lane",' ./*_test.go) | paste -sd'|' -)
[ -n "$tests" ] || { echo "nostacks pass: no test runs a lane verb" >&2; exit 1; }
go build -tags nostacks -o /dev/null .
go vet -tags nostacks ./...
echo "nostacks pass: $(echo "$tests" | tr '|' '\n' | wc -l | tr -d ' ') tests from files that run a lane verb"
GIT_CONFIG_GLOBAL=/dev/null go test -tags nostacks -run "^($tests)\$" ./...
