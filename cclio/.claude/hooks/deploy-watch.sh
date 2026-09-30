#!/bin/bash
# deploy-watch — after a push: the ci runs for one head, then the newest prod deploy of every
# app its Deploy run fired, as lines. emits only terminal states plus a heartbeat every 2 min, so a
# Monitor on it is quiet until something has actually finished — and a quiet wait is visible.
#   deploy-watch.sh [sha] [repo dir]   sha defaults to HEAD, repo dir to the cwd
# a vercel project is named after its app dir (apps/<name>); a Deploy that fired no hook ends
# after the ci runs. vercel webhooks are pro-only, so polling is the only door on this plan.
set -u
cd "${2:-.}" || exit 1
git fetch -q origin 2>/dev/null  # a squash-merge sha exists only on the remote until fetched
sha=$(git rev-parse "${1:-HEAD}")
short=${sha:0:8}
tick=15
beat=$((120 / tick))

runs_done() {
  gh run list --commit "$sha" --json status --jq 'length > 0 and all(.status=="completed")' 2>/dev/null
}

n=0
shown=
while :; do
  # the first sight of the runs prints their pages, so the waiting reply can link them (dima, 2026-09-28)
  if [ -z "$shown" ]; then
    links=$(gh run list --commit "$sha" --json name,url --jq '.[] | "🧪 [\(.name)](\(.url))"' 2>/dev/null)
    [ -n "$links" ] && { echo "👀 watching $short:"; echo "$links"; shown=1; }
  fi
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

# the Deploy run decides what deploys (turbo --affected), so its own log is the list — a path diff of
# our own guessed wrong twice: a root package.json marks every app, and atelier has no vercel project
deploy_run=$(gh run list --commit "$sha" --workflow deploy.yml --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null)
[ -z "$deploy_run" ] && { echo "no Deploy run for $short — nothing was asked to deploy"; exit 0; }
decision=$(gh run view "$deploy_run" --log 2>/dev/null | grep -E 'to deploy:|nothing affected that Vercel deploys' | head -1 | sed 's/.*Z //')
case "$decision" in
  *"to deploy:"*) apps=${decision#*to deploy:} ;;
  *"nothing affected"*) echo "Deploy for $short: nothing affected — no hooks fired"; exit 0 ;;
  *) echo "Deploy for $short: its log names no apps (run $deploy_run) — read it by hand"; exit 1 ;;
esac

for app in $apps; do
  n=0
  seen=
  while :; do
    url=$(vercel ls "$app" --prod 2>/dev/null | head -1)
    [ -z "$seen" ] && [ -n "$url" ] && { echo "🚀 [$app deploy](https://${url#https://})"; seen=1; }
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
