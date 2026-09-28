#!/bin/bash
# deploy-watch — after a push: the ci runs for one head, then the newest prod deploy of every
# app that head touched, as lines. emits only terminal states plus a heartbeat every 2 min, so a
# Monitor on it is quiet until something has actually finished — and a quiet wait is visible.
#   deploy-watch.sh [sha] [repo dir]   sha defaults to HEAD, repo dir to the cwd
# a vercel project is named after its app dir (apps/<name>); a head that touched no app ends
# after the ci runs. vercel webhooks are pro-only, so polling is the only door on this plan.
set -u
cd "${2:-.}" || exit 1
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
  # zero runs for a head reads exactly like «pending» — after 3 min it is a finding, never a wait
  if [ $n -eq 12 ] && [ "$(gh run list --commit "$sha" --json status --jq length 2>/dev/null)" = "0" ]; then
    echo "ci: NO run exists for $short in $(basename "$PWD") after 3 min — wrong repo, or no run was created"; exit 1
  fi
  [ $((n % beat)) -eq 0 ] && echo "… ci still running for $short ($((n * tick)) s)"
  [ $n -ge 120 ] && { echo "ci: no terminal state after 30 min for $short"; exit 1; }
  sleep $tick
done

# the whole pushed range, not the head alone — a push of two commits hid the first one's app
base=$(git rev-parse -q --verify "origin/main@{1}" 2>/dev/null)
changed() { if [ -n "$base" ]; then git diff --name-only "$base" "$sha"; else git diff-tree --no-commit-id --name-only -r "$sha"; fi; }
apps=$(changed | sed -n 's#^apps/\([^/]*\)/.*#\1#p' | sort -u)
# a shared package reaches every app, so a head touching packages/ deploys them all
changed | grep -q '^packages/' && apps=$(ls -d apps/*/ | sed 's#apps/\(.*\)/#\1#')
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
