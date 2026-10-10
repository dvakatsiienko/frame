#!/bin/bash
# index-run <command…> — runs a pre-commit gate against what the commit holds: a temp copy of the index,
# so a peer session's half-done edit in the shared checkout never blocks another session's commit.
# git exports GIT_INDEX_FILE to a hook, so a pathspec commit's temp index is the one copied.
# node_modules entries are symlinked from the tree; the mods' ignored tsconfig and engine types are copied in.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'trash "$tmp" 2>/dev/null' EXIT

git checkout-index -a --prefix="$tmp/"
for dir in . $(sed -n 's/^  - //p' "$repo/pnpm-workspace.yaml"); do
    # a real dir of links: pnpm -r refuses a node_modules that is itself a symlink
    [ -d "$repo/$dir/node_modules" ] && [ -d "$tmp/$dir" ] || continue
    mkdir "$tmp/$dir/node_modules"
    for entry in "$repo/$dir/node_modules"/* "$repo/$dir/node_modules"/.[!.]*; do
        # pnpm's own task state stays the copy's, a real dir it makes itself
        [ -e "$entry" ] && [ "${entry##*/}" != .pnpm-task-run-state-v1 ] && ln -s "$entry" "$tmp/$dir/node_modules/"
    done
done
(cd "$repo" && git ls-files --others --ignored --exclude-standard --directory -- 'home/.claude/plugin-x/mods/*/tsconfig.json' 'home/.claude/plugin-x/mods/*/.claude-plugin/types/') |
    while read -r path; do
        [ -e "$tmp/$(dirname "$path")" ] && cp -R "$repo/${path%/}" "$tmp/${path%/}"
    done

# pnpm checks its install before a script and dies on a symlinked node_modules; the copy never installs
printf '\nverifyDepsBeforeRun: false\n' >>"$tmp/pnpm-workspace.yaml"
cd "$tmp"
"$@"
