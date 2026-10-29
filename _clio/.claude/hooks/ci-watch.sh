#!/bin/bash
# ci-watch — failed github actions runs + failed vercel deploys, as lines.
# --boot   one pass over the last 48 h, prints every red (the boot digest calls it)
# --watch  loops every 5 min, prints only reds not seen before; silence is the normal state,
#          so a Monitor on it costs the session nothing until something is actually red.
# vercel webhooks are pro-only, so polling is the only door on this plan (measured 2026-09-18).
# a red counts only while it is the LATEST run of its branch+workflow (a fixed branch stops
# reporting the run it replaced); "no run at all" is NOT covered here.

MODE=${1:---boot}
SEEN="$HOME/.claude/shelf/ci-seen.json"
REPOS="dvakatsiienko/frame dvakatsiienko/bytes"
[ -s "$SEEN" ] || echo '[]' > "$SEEN"

reds() {
  local since_iso since_ms
  since_iso=$(date -u -v-48H '+%Y-%m-%dT%H:%M:%SZ')
  since_ms=$(( ( $(date +%s) - 48 * 3600 ) * 1000 ))
  for r in $REPOS; do
    gh api "repos/$r/actions/runs?created=>$since_iso&per_page=100" \
      --jq '[.workflow_runs[] | select(.conclusion != null)] | group_by(.head_branch + "|" + .name) | map(max_by(.created_at)) | .[]
            | select(.conclusion != "success" and .conclusion != "skipped" and .conclusion != "cancelled")
            | "gh:\(.id)\t\(.repository.name) · \(.name) · \(.head_branch) · \(.conclusion) · \(.html_url)"' 2>/dev/null \
      || printf 'fail:gh:%s\t🚨 gh unreachable for %s\n' "$r" "$r"
  done
  timeout 30 vercel ls --all --limit 40 --json 2>/dev/null \
    | jq -r --argjson s "$since_ms" '[.deployments[] | select(.createdAt > $s)] | group_by(.name + "|" + (.target // "")) | map(max_by(.createdAt)) | .[]
        | select(.state == "ERROR")
        | "vc:\(.url)\t\(.name) · vercel \(.target) · ERROR · https://\(.url)"' 2>/dev/null \
    || printf 'fail:vercel\t🚨 vercel unreachable\n'
}

case "$MODE" in
  --boot)
    out=$(reds); n=$(printf '%s' "$out" | grep -c .)
    [ "$n" -eq 0 ] && echo "ci + vercel: no reds in 48 h" || printf '%s\n' "$out" | cut -f2
    printf '%s' "$out" | grep -q '^fail:' && exit 1
    exit 0
    ;;
  --watch)
    while true; do
      reds | while IFS=$'\t' read -r id line; do
        [ -n "$id" ] || continue
        if ! jq -e --arg id "$id" 'index($id)' "$SEEN" >/dev/null; then
          echo "🔴 $line"
          jq --arg id "$id" '. + [$id] | .[-200:]' "$SEEN" > "$SEEN.tmp" && mv "$SEEN.tmp" "$SEEN"
        fi
      done
      sleep 300
    done
    ;;
esac
