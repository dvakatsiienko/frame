#!/bin/bash
# watch-pr.sh --verified: the clean, clio's name and the security sha land in pr-verified.json. runs with a fixture HOME.
here=$(cd "$(dirname "$0")" && pwd)
export HOME=$(mktemp -d "${TMPDIR:-/tmp}/watch-pr-test.XXXX")
trap 'rm -rf "$HOME"' EXIT
mkdir -p "$HOME/.claude/shelf"
store=$HOME/.claude/shelf/pr-verified.json
echo '{}' > "$store"
fail=0
check() { [ "$2" = "$3" ] || { echo "FAIL $1: got «$2», want «$3»"; fail=1; }; }
key() { jq -r --arg k "$1" '.[$k] // ""' "$store"; }

"$here/watch-pr.sh" --verified o/r 7 aaaaaaaa --security bbbbbbbb >/dev/null
check "clean" "$(key 'o/r#7')" aaaaaaaa
check "security" "$(key 'o/r#7:security')" bbbbbbbb
check "no by" "$(key 'o/r#7:by')" ""

"$here/watch-pr.sh" --verified o/r 7 cccccccc --by clio >/dev/null
check "clean moved" "$(key 'o/r#7')" cccccccc
check "security kept" "$(key 'o/r#7:security')" bbbbbbbb
check "by clio" "$(key 'o/r#7:by')" clio

"$here/watch-pr.sh" --verified o/r 8 dddddddd --security eeeeeeee --by clio >/dev/null
check "both flags" "$(key 'o/r#8:security'),$(key 'o/r#8:by')" eeeeeeee,clio

for bad in "--security nothex" "--by bob" "--security" "--extra x" "--security bbbbbbbb --security cccccccc"; do
  # shellcheck disable=SC2086
  "$here/watch-pr.sh" --verified o/r 9 ffffffff $bad 2>/dev/null; check "refused: $bad" "$?" 2
done
check "refused rows wrote nothing" "$(key 'o/r#9')" ""

[ $fail = 0 ] && echo "ok"
exit $fail
