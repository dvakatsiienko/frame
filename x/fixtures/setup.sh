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

cp -R "${here}/knowledge" "${world}/knowledge"

# a fake claude: logs its argv and cwd, answers in claude -p's json; the session id is fixed
mkdir "${world}/bin"
cat >"${world}/bin/claude" <<EOF
#!/bin/sh
printf '%s\n' "\$(pwd) \$*" >>"${world}/claude.log"
cat <<'JSON'
{"type":"result","subtype":"success","is_error":false,"result":"**it is cc**, not us: the bare session shows the same \`ToolSearch\` miss.\n\n- reproduced with no CLAUDE.md, rules or hooks\n- next: file it upstream","session_id":"0c9f2ab2-5152-4e7b-8158-2e88a7fc83b5","duration_ms":1181,"total_cost_usd":0.0082,"num_turns":1,"usage":{"input_tokens":10,"output_tokens":55,"cache_read_input_tokens":0,"cache_creation_input_tokens":17997},"modelUsage":{"claude-haiku-4-5-20251001":{}}}
JSON
EOF
chmod +x "${world}/bin/claude"
printf '{"disableAllHooks":true}\n' >"${world}/probe-settings.json"

# a brief with one miss of each kind, and a clean one
cat >"${world}/brief.md" <<'EOF'
# a brief

read `notes.txt` and `docs/gone.md`, then run `x lane commit` and `x lane shove`.

## exit lines

- `x lane commit` passes in 95% of runs
- the board looks right
EOF
cat >"${world}/brief-ok.md" <<'EOF'
# a brief

read `notes.txt`, then run `x lane commit`; a new `x lane tidy` (new) joins.

## exit lines

- `x lane commit msg.txt -- notes.txt` exits 0 in 20 of 20 runs
EOF

mkdir "${world}/store"
for file in "${here}"/handoffs/*.md; do
    name=${file##*/}
    cp "${file}" "${world}/store/${name}"
    stamp=$(sed -E 's/.*--([0-9]{8})T([0-9]{4})[0-9]*Z.*/\1\2/' <<<"${name}")
    touch -t "${stamp}" "${world}/store/${name}"
done
