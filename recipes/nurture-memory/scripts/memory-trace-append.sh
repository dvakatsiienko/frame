#!/usr/bin/env bash
# appends one line to the memory sweep's trace, stamped by the clock, never by hand.
# usage: memory-trace-append.sh "<what happened>" [trace file]   (default: docs/test-drive/memory-sweep.md)
# refuses: an empty line, a text that opens with its own clock (a composed stamp), a text already in the trace.
set -euo pipefail
text=${1:-}
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
trace=${2:-$root/docs/test-drive/memory-sweep.md}
[[ -n ${text// /} ]] || { echo "memory-trace-append: empty line" >&2; exit 1; }
if [[ $text =~ ^[0-9]{1,2}:[0-9]{2} || $text =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
  echo "memory-trace-append: the text opens with a clock — the script stamps it" >&2
  exit 1
fi
if grep -qF -- "· $text" "$trace"; then
  echo "memory-trace-append: already in the trace" >&2
  exit 1
fi
line="- $(date '+%Y-%m-%d %H:%M') · $text"
printf '%s\n' "$line" >> "$trace"
echo "$line"
