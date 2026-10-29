#!/bin/bash
# watch-once.sh: a «~ » line is logged and never ends the wait. runs with a fixture HOME and fake hooks.
here=$(cd "$(dirname "$0")" && pwd)
export HOME=$(mktemp -d)
unset CLAUDE_CODE_SESSION_ID
fail=0
check() { [ "$2" = "$3" ] || { echo "FAIL $1: got «$2», want «$3»"; fail=1; }; }

fake=$HOME/fake-hook.sh
log=$HOME/.local/state/cclio/watch-quiet.log

printf '#!/bin/bash\necho "~ quiet one"; sleep 3; echo "🟢 loud"; sleep 30\n' > "$fake"; chmod +x "$fake"
start=$SECONDS
got=$("$here/watch-once.sh" "$fake")
check "loud: stdout" "$got" "🟢 loud"
check "loud: log lines" "$(wc -l < "$log" | tr -d ' ')" 1
check "loud: log text" "$(grep -c 'quiet one' "$log")" 1
[ $((SECONDS - start)) -le 10 ] || { echo "FAIL loud: took $((SECONDS - start)) s"; fail=1; }

rm "$log"
printf '#!/bin/bash\necho "~ only quiet"\n' > "$fake"
got=$("$here/watch-once.sh" "$fake")
check "exit: stdout" "$got" "watch: $fake exited with no event"
check "exit: log text" "$(grep -c 'only quiet' "$log")" 1

[ $fail = 0 ] && echo "ok"
exit $fail
