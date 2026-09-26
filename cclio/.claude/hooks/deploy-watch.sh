#!/bin/bash
# deploy-watch — after a push: the ci runs for one head, then the newest prod deploy of every
# app that head touched, as lines. emits only terminal states plus a heartbeat every 2 min, so a
# Monitor on it is quiet until something has actually finished — and a quiet wait is visible.
#   deploy-watch.sh [sha]        run inside the repo; sha defaults to HEAD
# a vercel project is named after its app dir (apps/<name>); a head that touched no app ends
# after the ci runs. vercel webhooks are pro-only, so polling is the only door on this plan.
set -u
sha=$(git rev-parse "${1:-HEAD}")
short=${sha:0:8}
tick=15
beat=$((120 / tick))

runs_done() {
  gh run list --commit "$sha" --json status --jq 'length > 0 and all(.status=="completed")' 2>/dev/null
}

n=0
while :; do
  if [ "$(runs_done)" = "true" ]; then
    gh run list --commit "$sha" --json name,conclusion --jq '.[] | "ci \(.name) → \(.conclusion // "-")"'
    break
  fi
  n=$((n + 1))
  [ $((n % beat)) -eq 0 ] && echo "… ci still running for $short ($((n * tick)) s)"
  [ $n -ge 120 ] && { echo "ci: no terminal state after 30 min for $short"; exit 1; }
  sleep $tick
done

apps=$(git diff-tree --no-commit-id --name-only -r "$sha" | sed -n 's#^apps/\([^/]*\)/.*#\1#p' | sort -u)
# a shared package reaches every app, so a head touching packages/ deploys them all
git diff-tree --no-commit-id --name-only -r "$sha" | grep -q '^packages/' && apps=$(ls -d apps/*/ | sed 's#apps/\(.*\)/#\1#')
# an app with no vercel.json has no vercel project (atelier runs local only) — nothing to wait for
apps=$(for app in $apps; do [ -f "apps/$app/vercel.json" ] && echo "$app"; done)
[ -z "$apps" ] && { echo "no deployed app touched by $short — nothing deploys"; exit 0; }

for app in $apps; do
  n=0
  while :; do
    url=$(vercel ls "$app" --prod 2>/dev/null | head -1)
    st=$(vercel inspect "$url" 2>&1 | grep -E '^\s*status' | awk '{print $NF}')
    case "$st" in
      Ready) echo "deploy $app → Ready $url"; break ;;
      Error|Canceled) echo "deploy $app → $st $url"; break ;;
    esac
    n=$((n + 1))
    [ $((n % beat)) -eq 0 ] && echo "… $app deploy $st ($((n * tick)) s)"
    [ $n -ge 60 ] && { echo "deploy $app: no terminal state after 15 min (last: $st)"; break; }
    sleep $tick
  done
done
