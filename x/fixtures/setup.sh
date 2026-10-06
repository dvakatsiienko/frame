#!/usr/bin/env bash
# builds the fixture world every arm runs calls.json against, in a fresh dir:
#   <world>/origin.git  bare remote, main one commit ahead of the branch
#   <world>/repo        on coder/demo: notes.txt changed, draft.txt untracked
#   <world>/store       three handoffs, mtimes pinned to their filename stamps
#   <world>/msg.txt     a commit message; <world>/pr-body.md a pr body
set -euo pipefail

world=${1:?usage: setup.sh <empty dir>}
[[ -e ${world} && -n $(ls -A "${world}") ]] && {
    echo "setup.sh: ${world} is not empty" >&2
    exit 2
}
mkdir -p "${world}"
world=$(cd "${world}" && pwd -P)
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
export GIT_AUTHOR_DATE='2026-10-06T12:00:00Z' GIT_COMMITTER_DATE='2026-10-06T12:00:00Z'
g() { git -c user.name=fixture -c user.email=fixture@example.com -c commit.gpgsign=false "$@"; }

g init -q --bare -b main "${world}/origin.git"
g init -q -b main "${world}/repo"
cd "${world}/repo"
printf 'one\n' >readme.txt
printf 'first line\n' >notes.txt
g add . && g commit -q -m seed
g remote add origin "${world}/origin.git"
g push -q origin main
g switch -q -c coder/demo
g push -q origin coder/demo

# main moves on without the branch, so merge-main has something to bring
g switch -q main
printf 'from main\n' >main.txt
g add main.txt && g commit -q -m 'main moves'
g push -q origin main
g switch -q coder/demo
g branch -q -D main

printf 'second line\n' >>notes.txt
printf 'wip\n' >draft.txt

printf '🔧 notes: add a second line\n\n- ticket: FRM-284\n' >"${world}/msg.txt"
printf -- '- ticket: FRM-284\n' >"${world}/pr-body.md"

mkdir "${world}/store"
for file in "${here}"/handoffs/*.md; do
    name=${file##*/}
    cp "${file}" "${world}/store/${name}"
    stamp=$(sed -E 's/.*--([0-9]{8})T([0-9]{4})[0-9]*Z.*/\1\2/' <<<"${name}")
    touch -t "${stamp}" "${world}/store/${name}"
done
