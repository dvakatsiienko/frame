#!/usr/bin/env bash
# PostToolUse hook — formats a file right after an edit, with the biome that the edited
# file's OWN repo installs.
#
# Why walk up for the config instead of running one global biome: every repo pins its own
# biome version and rule set, so formatting with the wrong one writes a diff that repo's
# `check` would immediately undo. No biome.json(c) above the file, or no biome inside that
# repo's node_modules, means this is not a biome repo — stand down.
#
# Never prints and never fails. A formatter that interrupts the edit loop, or that reports
# a problem the agent did not ask about, costs more than an unformatted file.
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "$path" ] || exit 0
[ -f "$path" ] || exit 0

case "${path##*.}" in
    ts | tsx | js | jsx | json | jsonc | css) ;;
    *) exit 0 ;;
esac

dir=$(cd "$(dirname "$path")" 2>/dev/null && pwd) || exit 0
path="$dir/$(basename "$path")"

# A nested `"root": false` config only extends the root one; biome resolves it itself once it
# runs from the root, so the walk skips it.
root=""
while [ -n "$dir" ]; do
    for cfg in "$dir/biome.json" "$dir/biome.jsonc"; do
        [ -f "$cfg" ] || continue
        grep -Eq '"root"[[:space:]]*:[[:space:]]*false' "$cfg" && continue
        root=$dir
        break 2
    done
    [ "$dir" = "/" ] && break
    dir=$(dirname "$dir")
done
[ -n "$root" ] || exit 0

biome="$root/node_modules/.bin/biome"
[ -x "$biome" ] || exit 0

# biome reads its config from the cwd, never from the file's location — run anywhere else and
# it formats with its defaults (tabs, double quotes) or panics on a path outside its root.
cd "$root" || exit 0
"$biome" check --write --no-errors-on-unmatched --files-ignore-unknown=true "$path" >/dev/null 2>&1
exit 0
