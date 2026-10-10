#!/bin/bash
# index-run <command…> — runs a pre-commit gate against what the commit holds: a temp copy of the index,
# so a peer session's half-done edit in the shared checkout never blocks another session's commit.
# git exports GIT_INDEX_FILE to a hook, so a pathspec commit's temp index is the one copied.
# node_modules entries are symlinked from the tree, workspace packages to their copy; the mods' ignored
# tsconfig and engine types are copied in.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'trash "$tmp" 2>/dev/null' EXIT

# git-crypt files stay ciphertext, as on the ci runner: no plaintext secret lands in a temp dir or the Trash
git -c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false checkout-index -a --prefix="$tmp/"
# a gitfile, so a test that reads the repo through git reads this commit, never «not a git repository»
echo "gitdir: $(git rev-parse --absolute-git-dir)" >"$tmp/.git"

# a workspace package resolves to its copy, so a peer's edit in one never reaches the gate through a link
link() {
    local target
    target=$(realpath "$1")
    case $target in
    "$repo"/node_modules/* | "$repo"/*/node_modules/* | "$repo"/*/*/node_modules/*) ln -s "$1" "$2" ;;
    "$repo"/*) ln -s "$tmp/${target#"$repo"/}" "$2" ;;
    *) ln -s "$1" "$2" ;;
    esac
}
for dir in . $(sed -n 's/^  - //p' "$repo/pnpm-workspace.yaml"); do
    # a real dir of links: pnpm -r refuses a node_modules that is itself a symlink
    [ -d "$repo/$dir/node_modules" ] && [ -d "$tmp/$dir" ] || continue
    mkdir "$tmp/$dir/node_modules"
    for entry in "$repo/$dir/node_modules"/* "$repo/$dir/node_modules"/.[!.]*; do
        name=${entry##*/}
        # pnpm's own task state stays the copy's, a real dir it makes itself
        [ -e "$entry" ] && [ "$name" != .pnpm-task-run-state-v1 ] || continue
        if [[ $name == @* ]] && [ -d "$entry" ] && [ ! -L "$entry" ]; then
            mkdir "$tmp/$dir/node_modules/$name"
            for scoped in "$entry"/*; do link "$scoped" "$tmp/$dir/node_modules/$name/"; done
        else
            link "$entry" "$tmp/$dir/node_modules/"
        fi
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
