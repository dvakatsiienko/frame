#!/bin/bash
# pr-watch — every open non-renovate pr in frame + bytes, and every cloud/* report branch, as lines.
# a pr prints when its head moves (a new commit) and once per head when every check is green —
# «ready to merge». a cloud/* branch prints when it gains a commit: a cloud session sends no idle
# notice, so its brief ends by pushing its report there (x:crew-cloud). silence is the normal state.
# the watch belongs to the pr, never to the coder that opened it (2026-09-28: #112 sat green 30 min
# after its coder's watch was stopped).

REPOS="dvakatsiienko/frame dvakatsiienko/bytes"
SEEN="$HOME/.claude/shelf/pr-watch-seen.json"
[ -s "$SEEN" ] || echo '{}' > "$SEEN"

seen() { jq -r --arg k "$1" '.[$k] // ""' "$SEEN"; }
mark() { jq --arg k "$1" --arg v "$2" '.[$k] = $v' "$SEEN" > "$SEEN.tmp" && mv "$SEEN.tmp" "$SEEN"; }

pass() {
  for r in $REPOS; do
    gh pr list -R "$r" --state open --json number,title,url,headRefOid,author,statusCheckRollup \
      --jq '.[] | select(.author.login != "app/renovate")
        | [.number, .headRefOid[0:8], .url, .title,
           ([.statusCheckRollup[] | (.conclusion // .status)] | if length == 0 then "none"
             elif all(. == "SUCCESS" or . == "SKIPPED" or . == "NEUTRAL") then "green"
             elif any(. == "FAILURE" or . == "ERROR" or . == "TIMED_OUT") then "red" else "pending" end)]
        | @tsv' 2>/dev/null |
      while IFS=$'\t' read -r n sha url title state; do
        key="$r#$n"
        if [ "$(seen "$key:head")" != "$sha" ]; then
          [ -n "$(seen "$key:head")" ] && echo "🟡 ${r#*/}#$n new commit $sha · $title · $url"
          mark "$key:head" "$sha"
        fi
        if [ "$state" = green ] && [ "$(seen "$key:green")" != "$sha" ]; then
          echo "🟢 ${r#*/}#$n green on $sha, ready to merge · $title · $url"
          mark "$key:green" "$sha"
        fi
      done
    gh api "repos/$r/branches?per_page=100" \
      --jq '.[] | select(.name | startswith("cloud/")) | [.name, .commit.sha[0:8]] | @tsv' 2>/dev/null |
      while IFS=$'\t' read -r b sha; do
        key="$r@$b"
        if [ "$(seen "$key")" != "$sha" ]; then
          echo "☁️ ${r#*/} $b → $sha · a cloud session pushed its report"
          mark "$key" "$sha"
        fi
      done
  done
}

case "${1:---watch}" in
  --once) pass ;;
  --watch) while true; do pass; sleep 60; done ;;
esac
