#!/usr/bin/env bash
# shoots every tty call in calls.json for one FRM-284 arm, the same way for every arm:
#   shoot.sh <arm> '<x-cmd>' [<call-id>…]
#   <x-cmd> runs x, env prefix included: 'env X_VIEW=gum bun <tree>/x/main.ts', '<tree>/x/go/bin/x'
# per call: a fresh world (setup.sh, the `after` call replayed first), a vhs tape + gif, a png.
# a call with `keys` takes the vhs Screenshot as its png; the rest take a freeze --execute shot.
# out: ~/.local/state/looks/FRM-284/<arm>/<utc stamp>/<call-id>.{tape,gif,png} — a fresh dir per
# run, because vhs never overwrites an existing Screenshot and nothing there is ever deleted.
set -euo pipefail

arm=${1:?usage: shoot.sh <arm> '<x-cmd>' [<call-id>…]}
xcmd=${2:?usage: shoot.sh <arm> '<x-cmd>' [<call-id>…]}
shift 2
only=("$@")

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
calls=${here}/calls.json
out=${LOOKS_ROOT:-${HOME}/.local/state/looks/FRM-284}/${arm}/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "${out}/worlds"

for tool in vhs freeze jq go; do
    command -v "${tool}" >/dev/null || {
        echo "shoot.sh: ${tool} is missing — brew install ${tool}" >&2
        exit 2
    }
done

# freeze --execute cannot replay a view that moves the cursor (bubbletea, ink repaint in place):
# the pty bytes go through a vt emulator first, and freeze shoots the screen it ends on
replay=${out}/.vtreplay
go build -C "${here}/vtreplay" -o "${replay}" . || exit 2

# dima's iterm: Hack 16 at spacing 1.0 (studio jobs/cli/decision.md); one look for every arm
font=Hack
# freeze draws only from a font file it is handed; a family name it lacks renders no glyphs at all
font_file=$(ls ~/Library/Fonts/Hack-Regular.ttf /Library/Fonts/Hack-Regular.ttf 2>/dev/null | head -n 1 || true)
freeze_font=(--font.file="${font_file}")
[[ -z ${font_file} ]] && font=Menlo freeze_font=()
cell=10
theme='{"name":"t2","background":"#17181C","foreground":"#D7D9DF","cursor":"#D7D9DF","selection":"#3A3D45","black":"#17181C","red":"#E8696B","green":"#9AD59A","yellow":"#E0A458","blue":"#6FA0EA","magenta":"#E8A6D6","cyan":"#3FB8A4","white":"#D7D9DF","brightBlack":"#7C808C","brightRed":"#E8696B","brightGreen":"#9AD59A","brightYellow":"#E0A458","brightBlue":"#6FA0EA","brightMagenta":"#E8A6D6","brightCyan":"#3FB8A4","brightWhite":"#FFFFFF"}'

# a vhs key name passes as a key; anything else is typed text
vhs_key() {
    case $1 in
    Enter | Tab | Space | Backspace | Escape | Up | Down | Left | Right) echo "$1" ;;
    *) printf 'Type %s\n' "$(vhs_str "$1")" ;;
    esac
}

# vhs strings have no escapes; a backtick string holds both quote kinds
vhs_str() {
    [[ $1 == *'`'* ]] && {
        echo "shoot.sh: a backtick cannot reach a tape: $1" >&2
        exit 2
    }
    printf '`%s`' "$1"
}

argv_of() {
    jq -r --arg w "$2" '.argv | map(gsub("\\{world\\}"; $w)) | map(if test("^[A-Za-z0-9_./:=@%+,-]+$") then . else @sh end) | join(" ")' <<<"$1"
}

shot=0
while IFS= read -r call; do
    id=$(jq -r .id <<<"${call}")
    if ((${#only[@]})) && [[ ! " ${only[*]} " == *" ${id} "* ]]; then continue; fi

    world=${out}/worlds/${id}
    "${here}/setup.sh" "${world}" >/dev/null
    after=$(jq -r '.after // empty' <<<"${call}")
    if [[ -n ${after} ]]; then
        prior=$(jq -c --arg id "${after}" '.calls[] | select(.id == $id)' "${calls}")
        (cd "${world}/repo" && env -u CLAUDECODE -u AI_AGENT HANDOFF_STORE_ROOT="${world}/store" \
            bash -c "${xcmd} $(argv_of "${prior}" ..)" </dev/null >/dev/null 2>&1) || true
    fi

    cols=$(jq -r '.cols // 120' <<<"${call}")
    args=$(argv_of "${call}" ..)
    typed="x ${args}"
    [[ $(jq -r '.stdin // empty' <<<"${call}") == none ]] && typed+=" </dev/null"
    env_set=$(jq -r '(.env // {}) | to_entries | map("export \(.key)=\(.value|@sh)") | join("; ")' <<<"${call}")
    has_keys=$(jq -r '(.keys // []) | length' <<<"${call}")

    tape=${out}/${id}.tape
    {
        printf 'Output %s\n' "\"${out}/${id}.gif\""
        printf 'Set Shell "bash"\nSet FontFamily "%s"\nSet FontSize 16\nSet LineHeight 1.0\n' "${font}"
        printf 'Set Width %d\nSet Height 900\nSet Padding 24\nSet TypingSpeed 20ms\n' $((cols * cell + 48))
        printf "Set Theme '%s'\n" "${theme}"
        printf 'Hide\n'
        # cc sessions export CLAUDECODE=1 and vhs inherits it: every view would render as json
        printf 'Type %s\nEnter\n' "$(vhs_str "unset CLAUDECODE AI_AGENT; export HANDOFF_STORE_ROOT='${world}/store' PS1='\$ '; x() { ${xcmd} \"\$@\"; }; cd '${world}/repo'; ${env_set:-:}; clear")"
        printf 'Sleep 500ms\nShow\n'
        printf 'Type %s\nSleep 300ms\nEnter\nSleep 2500ms\n' "$(vhs_str "${typed}")"
        # a still before every key: <id>.png is the open form or picker, -key<n>.png each step after,
        # -vhs.png the end state (a y/n key submits by itself, so «just before the last key» is too late)
        i=0
        while IFS= read -r key; do
            i=$((i + 1))
            if ((i == 1)); then
                printf 'Screenshot %s\n' "\"${out}/${id}.png\""
            else
                printf 'Screenshot %s\n' "\"${out}/${id}-key${i}.png\""
            fi
            # vhs takes the still on a later frame; a key sent at once lands in it
            printf 'Sleep 600ms\n'
            vhs_key "${key}"
            printf 'Sleep 700ms\n'
        done < <(jq -r '(.keys // [])[] | gsub("\\{world\\}"; "..")' <<<"${call}")
        printf 'Sleep 2s\nScreenshot %s\nSleep 1s\n' "\"${out}/${id}-vhs.png\""
    } >"${tape}"
    timeout 180 vhs "${tape}" >"${out}/${id}.vhs.log" 2>&1 || echo "shoot.sh: vhs failed on ${id}, see ${id}.vhs.log" >&2

    if ((has_keys == 0)); then
        # a fresh world again: the vhs run above already spent this one (a commit, an ingest)
        fresh=${out}/worlds/${id}-freeze
        "${here}/setup.sh" "${fresh}" >/dev/null
        if [[ -n ${after} ]]; then
            (cd "${fresh}/repo" && env -u CLAUDECODE -u AI_AGENT HANDOFF_STORE_ROOT="${fresh}/store" \
                bash -c "${xcmd} $(argv_of "${prior}" ..)" </dev/null >/dev/null 2>&1) || true
        fi
        stdin=''
        [[ $(jq -r '.stdin // empty' <<<"${call}") == none ]] && stdin=' </dev/null'
        runner=${out}/${id}.run.sh
        {
            printf 'unset CLAUDECODE AI_AGENT; export HANDOFF_STORE_ROOT=%q\n' "${fresh}/store"
            printf 'cd %q && stty cols %d rows 60; %s\n' "${fresh}/repo" "${cols}" "${env_set:-:}"
            printf 'printf "\\033[1m$ x %%s\\033[0m\\n" %q\n' "$(argv_of "${call}" ..)"
            printf '%s %s%s\n' "${xcmd}" "$(argv_of "${call}" ..)" "${stdin}"
        } >"${runner}"
        timeout 60 script -q "${out}/${id}.pty" bash "${runner}" </dev/null >/dev/null 2>&1 || true
        tr -d '\004\010' <"${out}/${id}.pty" | sed -e '1s/^^D//' | "${replay}" "${cols}" 80 >"${out}/${id}.ansi"
        timeout 60 freeze --language=ansi --background='#17181C' "${freeze_font[@]}" --font.size=16 \
            --line-height=1.0 --padding=24 --window=false -o "${out}/${id}.png" "${out}/${id}.ansi" </dev/null >/dev/null 2>&1 ||
            echo "shoot.sh: freeze failed on ${id}" >&2
    fi
    shot=$((shot + 1))
    echo "${id}"
done < <(jq -c '.calls[] | select(.mode == "tty")' "${calls}")

echo "shot ${shot} calls → ${out}"
