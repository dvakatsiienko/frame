#!/bin/bash
# cclio boot digest — every check the boot ritual needs, one run, one status line per check.
# fires as the SessionStart hook AND by hand from /cclio:boot when the last digest is stale.
# list-only, with one write: a clean main that is only behind origin gets an ff-only pull + install.
# never ingests, never deletes. a check that cannot run prints FAIL, never silence —
# an agent reading a digest cannot tell a skipped check from a passed one.
# BOOT_STRICT=1 → exit 1 on any FAIL (the by-hand mode); the hook mode always exits 0.

# BOOT_PROBE=1 marks the hook's own nested `claude -p` — that process skips the digest, or the probe recurses
[ -n "$BOOT_PROBE" ] && exit 0
fails=0
fail() { echo "🚨 FAIL · $1"; fails=$((fails + 1)); }
STAMP="$HOME/.claude/shelf/boot-digest.stamp"
VAULT="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq"

echo "=== cclio boot digest · $(date '+%Y-%m-%d %H:%M') ==="
# after a compaction (stdin source=compact) or `--compact` by hand: the day-opener checks stay out
in=$([ -t 0 ] || timeout 1 cat)
{ [ "$(printf %s "$in" | jq -r '.source // empty' 2>/dev/null)" = compact ] || [ "${1:-}" = --compact ]; } && COMPACT=1 && echo "(compact mode — the full digest: boot-prefetch.sh)"

echo "-- pending handoffs (list-only; ingest via /x:handoff-ingest) --"
found=0
for f in "$HOME"/.claude/shelf/handoffs/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  stem=${base%.md}; stem=${stem%-shared}
  # `<for>--<lane>--<topic>--by-<author>--<stamp>`; a legacy name has no `--` at
  # all, and only its first field ever meant an audience.
  if [[ "$stem" == *--*--*--*--* ]]; then
    rest="$stem"
    audience=${rest%%--*}; rest=${rest#*--}
    lane=${rest%%--*};     rest=${rest#*--}
    topic=${rest%%--*};    rest=${rest#*--}
    author=${rest%%--*};   author=${author#by-}
    line="$lane lane · by $author · $topic"
  else
    audience=${stem%%-*}
    line="$base (legacy name — no lane, no author)"
  fi
  # A whitelist, so an unparsed field can never wrongly claim a file is someone
  # else's and get it left behind forever.
  case "$audience" in
    cw|ccli) tag=" [for $audience — leave it]" ;;
    *) tag="" ;;
  esac
  age_min=$(( ( $(date +%s) - $(stat -f %m "$f") ) / 60 ))
  echo "$line (${age_min}m old)$tag"
  found=1
done
[ "$found" = 0 ] && echo "none"

echo "-- inbox --"
if [ -r "$VAULT/inbox.md" ]; then
  # the template's own lines never count: its frontmatter, `## ` headers, `> ` hints, dash rules
  n=$(awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} fm {next} /^## |^> |^-+$|^[[:space:]]*$/ {next} {c++} END {print c+0}' "$VAULT/inbox.md")
  [ "$n" = 0 ] && echo "clean" || echo "$n content lines — parse into the pocket before any work"
  grep -q 'FROZEN' "$VAULT/inbox.md" && echo "FROZEN marker present — do not touch"
  if [ -z "${COMPACT:-}" ]; then
  echo "-- inbox, laned by jev (script/lib/jev-questions.ts; ⏳ = band 0.30–0.70, dima's call) --"
  timeout 25 ~/frame/script/op-run.sh node ~/frame/script/inbox-triage.ts 2>/dev/null || echo "jev triage unavailable — lane by hand"
  fi
else
  fail "inbox unreadable (icloud not mounted?)"
fi

# the resident roadmap outline, refreshed in both modes: memory/_roadmap.md rides the barrel import
"$HOME/frame/cclio/.claude/hooks/roadmap-prefetch.sh" --outline > /dev/null

if [ -z "${COMPACT:-}" ]; then
echo "-- jev vet (pnpm jev:vet ok|miss <flow> <note> records a verdict; a miss restarts the window) --"
node "$HOME/frame/script/jev-vet.ts" 2>/dev/null || fail "jev vet registry unreadable"
health=$(timeout 15 "$HOME/frame/script/op-run.sh" node "$HOME/frame/script/jev-report.ts" --health 2>&1) && echo "jev health: $health" || fail "jev: ${health:-probe did not run}"

"$HOME/frame/cclio/.claude/hooks/gazette-trail.sh"   # gazette rides the memory import, not stdout

roadmap=$("$HOME/frame/cclio/.claude/hooks/roadmap-prefetch.sh")
if echo "$roadmap" | grep -q '^-- scope'; then
  echo "$roadmap"
else
  fail "tracker unreachable — roadmap prefetch returned nothing (linear auth or network)"
fi

fi

echo "-- stuck reminders (raise every one in the opening board) --"
grep '^⏰📌' "$HOME/frame/cclio/memory/_reminders.md" 2>/dev/null || echo "none"

echo "-- fleet: live sessions · worktrees · coder prs --"
# the name is what SendMessage and the board use; a cwd count alone hid a peer editing frame (2026-09-27)
# an interactive session that is not cclio is one dima opened himself (desktop or remote control): 👤, never on a stop list.
# the fleet's own (coders, verifiers, ccrow, probes) are spawned with --bg
live=$(jq -r '"\(.cwd // "?") · \(.name // "unnamed") · \(.entrypoint // .kind // "?")\(if .kind == "interactive" and ((.name // "") | test("cclio") | not) then " · 👤 dima'"'"'s — never stop" else "" end)"' "$HOME"/.claude/sessions/*.json 2>/dev/null | sort)
[ -n "$live" ] && echo "$live" || echo "no live sessions registered"
wt=$(git -C "$HOME/projects/bytes" worktree list 2>/dev/null | grep -v '^/Users/dima/projects/bytes ' )
[ -n "$wt" ] && echo "$wt" || echo "no bytes worktrees"
for repo in bytes frame; do
  prs=$(gh pr list -R "dvakatsiienko/$repo" --search 'head:coder/' --json number,title,headRefName --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"' 2>/dev/null) || { fail "gh unreachable for $repo"; continue; }
  [ -n "$prs" ] && echo "$repo coder prs: $prs" || echo "$repo: no open coder prs"
done

if [ -z "${COMPACT:-}" ]; then
echo "-- renovate (digest is /cclio:evergreen, on his word) --"
for repo in bytes frame; do
  gh pr list -R "dvakatsiienko/$repo" --search 'author:app/renovate' --json number,createdAt 2>/dev/null \
    | jq -r --arg r "$repo" 'if length == 0 then "\($r): 0" else "\($r): \(length) open · oldest \(min_by(.createdAt).createdAt[:10])" end' \
    || fail "gh unreachable for renovate/$repo"
done
jq -r --arg today "$(date +%Y-%m-%d)" '(map(.markedAt) | max) as $m
  | ($today | strptime("%Y-%m-%d") | mktime) as $t
  | ($t - ((($t | strftime("%u") | tonumber) + 4) % 7) * 86400 | strftime("%Y-%m-%d")) as $wednesday
  | "apps lane: \(length) apps · last marked \($m) · " + (if $m < $wednesday then "DUE (a wednesday passed) — pnpm skill:evergreen-apps" else "next wednesday" end)' \
  "$HOME/frame/cclio/evergreen/sources.json" || fail "apps lane index unreadable"

fi

echo "-- go vulns in x/go (pnpm x-go:vuln, ~3 s) --"
vuln=$(cd "$HOME/frame" && pnpm --silent x-go:vuln 2>&1)
vulns=$(printf '%s\n' "$vuln" | grep -c '^Vulnerability #')
if [ "$vulns" = 0 ]; then echo "x/go: no reachable vulns"; else echo "x/go: $vulns reachable vulns — fixed in: $(printf '%s\n' "$vuln" | sed -n 's/.*Fixed in: //p' | sort -u | tr '\n' ' ')"; fi

echo "-- usage (x-mod-stash writes rate_limits to shelf/cc-usage-window.json on every session.measure, terminal and desktop) --"
jq -r --argjson now "$(date +%s)" '
  def left(t): ((t - $now) / 3600 | floor | tostring) + " h";
  # dima paces a week at ~15 % a day (100 / 7): the window started 7 days before its reset
  (.rate_limits.seven_day.resets_at // null) as $r
  | (if $r then (($now - ($r - 604800)) / 86400 * 100 / 7 | floor) else null end) as $pace
  | "weekly \(.rate_limits.seven_day.used_percentage // "?") % · pace \($pace // "?") % · resets in \(left($r // $now))"
  + " · 5h \(.rate_limits.five_hour.used_percentage // "?") %"
  + " · read " + ((($now - .written_at) / 60 | floor) as $m | if $m < 60 then "\($m) min ago" else "\($m / 60 | floor) h ago" end)
  + (if ($now - .written_at) > 1800 then " (stale: x-mod-stash writes it on every session.measure — `get_usage` is live)" else "" end)' "$HOME/.claude/shelf/cc-usage-window.json" 2>/dev/null \
  || fail "no usage file — x-mod-stash has not measured yet (shelf/cc-usage-window.json)"

echo "-- repos vs origin (behind-only on a clean main → pulled here; anything else → the reason it was not) --"
for repo in "$HOME/frame" "$HOME/projects/bytes"; do
  name=$(basename "$repo")
  git -C "$repo" fetch -q 2>/dev/null || { fail "fetch failed in $name"; continue; }
  counts=$(git -C "$repo" rev-list --left-right --count HEAD...@{upstream} 2>/dev/null)
  ahead=${counts%%	*}; behind=${counts##*	}
  if [ "$behind" = 0 ]; then
    [ "$ahead" = 0 ] && echo "$name: in sync" || echo "$name: ahead $ahead, push pending"
    continue
  fi
  branch=$(git -C "$repo" branch --show-current)
  if [ "$branch" != main ] || [ "$ahead" != 0 ] || [ -n "$(git -C "$repo" status --porcelain --untracked-files=no)" ]; then
    echo "$name: behind $behind, NOT pulled — branch $branch · ahead $ahead · tracked changes: $(git -C "$repo" status --porcelain --untracked-files=no | wc -l | tr -d ' ')"
    continue
  fi
  old=$(git -C "$repo" rev-parse HEAD)
  git -C "$repo" pull -q --ff-only 2>/dev/null || { fail "ff-only pull refused in $name"; continue; }
  echo "$name: pulled +$behind"
  git -C "$repo" log --format='  - %s' "$old..HEAD"
  git -C "$repo" diff --quiet "$old" HEAD -- pnpm-lock.yaml && continue
  (cd "$repo" && pnpm install --frozen-lockfile --silent >/dev/null 2>&1) || { fail "pnpm install failed in $name after the pull"; continue; }
  echo "  installed (lockfile moved)"
  # a vite dev server keeps a failed import until it restarts (bytes #102), so every job served from this repo restarts
  for plist in "$HOME"/Library/LaunchAgents/com.dima.*.plist; do
    wd=$(plutil -extract WorkingDirectory raw "$plist" 2>/dev/null) || continue
    [[ "$wd" == "$repo"/* ]] || continue
    label=$(basename "$plist" .plist)
    launchctl kickstart -k "gui/$(id -u)/$label" && echo "  restarted $label" || fail "kickstart $label failed"
  done
done

echo "-- ci + vercel reds, 48 h (ci-watch.sh --boot; --watch is the in-session monitor) --"
# the FAIL names the call that failed — a bare «could not query» sat next to a working gh twice (FRM-261)
cw_err=$(mktemp)
"$(dirname "$0")/ci-watch.sh" --boot 2>"$cw_err" || fail "ci-watch --boot exited $?: $(grep . "$cw_err" | tail -1 || echo 'no stderr')"
rm -f "$cw_err"

if [ -z "${COMPACT:-}" ]; then
echo "-- app essentials (bytes/script/apps-essentials.ts, BYT-111; 🔴 = a gap to fold into today) --"
ESS="$HOME/projects/bytes/script/apps-essentials.ts"
if [ -f "$ESS" ]; then
  (cd "$HOME/projects/bytes" && node "$ESS" 2>&1 | tail -20)
  node "$ESS" --app "$HOME/frame/hotkeys/chords" 2>&1 | grep -v '^✅'
else
  echo "bytes checker not found — skipped"
fi

echo "-- gh watch (every github issue/pr link in _reminders.md and mods/workarounds.md + every issue dima filed outside his repos; a change prints once, state in gh-watch-seen.tsv) --"
GH_SEEN="$HOME/.claude/shelf/gh-watch-seen.tsv"
touch "$GH_SEEN"
# an authored issue is watched while open, plus the one boot that sees it close
authored=$(timeout 15 gh search issues --author dvakatsiienko --limit 100 --json url,state \
  --jq '.[] | select(.url | test("github.com/dvakatsiienko/") | not) | "\(.url) \(.state)"' 2>/dev/null |
  while read -r u s; do
    if [ "$s" = "open" ] || awk -F'\t' -v u="$u" '$1 == u && $2 ~ /^open/ { f = 1 } END { exit !f }' "$GH_SEEN"; then
      printf '%s\n' "$u"
    fi
  done)
gh_urls=$( { grep -ho 'https://github.com/[^/)]*/[^/)]*/\(issues\|pull\)/[0-9]*' "$HOME/frame/cclio/memory/_reminders.md" "$HOME/frame/home/.claude/plugin-x/mods/workarounds.md"; printf '%s\n' "$authored"; } | grep . | sort -u)
gh_ok=0 gh_changed=0 gh_state=""
for url in $gh_urls; do
  api=$(printf '%s' "$url" | sed -E 's#https://github.com/([^/]+)/([^/]+)/(issues|pull)/([0-9]+)#repos/\1/\2/issues/\4#')
  now=$(timeout 10 gh api "$api" --jq '[.state, (.state_reason // ""), (.pull_request.merged_at // ""), ([.labels[].name] | join(",")), (.comments | tostring)] | join(" · ")' 2>/dev/null) || continue
  gh_ok=$((gh_ok + 1))
  gh_state="$gh_state$url	$now
"
  before=$(awk -F'\t' -v u="$url" '$1 == u { print $2 }' "$GH_SEEN")
  if [ "$before" != "$now" ]; then
    gh_changed=$((gh_changed + 1))
    echo "🐙 $url — ${before:-new} → $now"
  fi
done
gh_total=$(printf '%s\n' "$gh_urls" | grep -c .)
if [ "$gh_ok" -lt "$gh_total" ]; then
  fail "gh watch: $gh_ok of $gh_total links answered"
fi
if [ "$gh_ok" -gt 0 ]; then
  printf '%s' "$gh_state" > "$GH_SEEN"
  if [ "$gh_changed" -eq 0 ]; then echo "$gh_ok watched, no change"; fi
fi

echo "-- parallel monitors (pull-only: unseen events print once, ids land in parallel-monitor-seen.txt) --"
SEEN="$HOME/.claude/shelf/parallel-monitor-seen.txt"
touch "$SEEN"
if events=$(timeout 40 "$HOME/frame/script/op-run.sh" bash -c '
  set -o pipefail
  parallel-cli monitor list --json | jq -r ".monitors[] | [.monitor_id, .settings.query] | @tsv" |
  while IFS="	" read -r id query; do
    parallel-cli monitor events "$id" --json |
      jq -c --arg q "$query" ".events[] | {id: .event_id, date: .event_date, q: \$q, text: .output.content}"
  done' 2>/dev/null); then
  new=$(printf '%s\n' "$events" | jq -c --rawfile seen "$SEEN" 'select(.id as $i | $seen | split("\n") | index($i) | not)')
  if [ -z "$new" ]; then
    echo "no unseen events"
  else
    printf '%s\n' "$new" | jq -r '"📡 \(.date) · \(.q[:70]) — \(.text)"'
    printf '%s\n' "$new" | jq -r .id >>"$SEEN"
  fi
else
  fail "parallel monitors: query did not run"
fi

echo "-- settings.json symlink --"
if [ -L "$HOME/.claude/settings.json" ]; then
  echo "symlink OK"
else
  fail "REAL FILE where the symlink belongs — silent divergence"
fi

echo "-- runtime (a parked session keeps its binary, plugins and feature gates until a restart) --"
pid=$$; born=""
for _ in 1 2 3 4 5 6; do
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' '); [ -z "$pid" ] || [ "$pid" = 1 ] && break
  case "$(ps -o args= -p "$pid" 2>/dev/null)" in claude\ *|*/bin/claude\ *|*/bin/claude|*/versions/[0-9]*) born=$(ps -o lstart= -p "$pid"); age=$(ps -o etime= -p "$pid" | tr -d ' '); break;; esac
done
[ -n "$born" ] && echo "process $pid up ${age} (since ${born}) · $(claude --version 2>/dev/null)" || echo "process: not found in the parent chain"
# a `--bg` coder claims the daemon's pre-warmed spare; a day-old spare booted one without the repo AGENTS.md (2026-09-22)
live_pids=$(jq -r '.pid // empty' "$HOME"/.claude/sessions/*.json 2>/dev/null)
spares=0
while read -r spid slstart; do
  [ -z "$spid" ] && continue
  echo "$live_pids" | grep -qx "$spid" && continue
  spares=$((spares + 1))
  born_s=$(date -j -f '%a %b %d %T %Y' "$slstart" +%s 2>/dev/null || echo 0)
  hours=$(( ( $(date +%s) - born_s ) / 3600 ))
  flag=""; [ "$hours" -gt 6 ] && flag="⚠️ stale spare — a --bg coder claimed now boots without the repo AGENTS.md; refresh before spawning · "
  echo "${flag}warm spare $spid · born $slstart · age ${hours}h"
done < <(ps -o pid=,lstart=,command= -ax | awk '/claude bg-spare/ && !/awk/ {print $1, $2, $3, $4, $5, $6}')
[ "$spares" = 0 ] && echo "no warm spare"
# measured 2026-09-21: the loaded chain spawns at ~75.6k prompt tokens, the same spawn with no cclio
# barrel at ~46.5k (base prompt + global ~/.claude + plugins). 60k sits between them, so the logged
# ctx is what separates «the model whiffed» from «the import chain broke» on the next red.
probe_run() {
  (cd "$(dirname "$0")/../.." && BOOT_PROBE=1 timeout 60 claude -p 'reply with only the commit hash named in the sys-settings-drift memory leaf, or NONE' --model haiku --output-format json 2>/dev/null) \
    | jq -r '[(.result // "nothing"), ((.usage.input_tokens // 0) + (.usage.cache_read_input_tokens // 0) + (.usage.cache_creation_input_tokens // 0))] | @tsv'
}
for attempt in 1 2; do
  IFS=$'\t' read -r probe ctx < <(probe_run)
  printf '%s\tattempt=%s\tctx=%s\treply=%s\n' "$(date +%FT%T)" "$attempt" "${ctx:-0}" "${probe:-nothing}" >> "$HOME/.claude/shelf/barrel-probe.log"
  case "$probe" in *d03f3da*) break;; esac
done
if case "$probe" in *d03f3da*) true;; *) false;; esac; then
  echo "barrel probe: a fresh process loads the chain (d03f3da)"
elif [ "${ctx:-0}" -ge 60000 ]; then
  fail "barrel probe: the chain LOADED (ctx ${ctx}) yet two fresh calls answered '${probe}' — a model miss, not a broken import"
else
  fail "barrel probe: a fresh process cannot name d03f3da (ctx ${ctx:-0}, got: ${probe:-nothing}) — the import chain is broken"
fi
echo "📌 this hook proves the FILE chain in a fresh process; the running session proves itself at init step 1 — a stale gate in a parked process only that step sees"

fi

echo "-- pocket (Backlog.md, cclio/script/pocket-check.ts; a red is drift to fix today, not a broken boot) --"
if out=$(node "$HOME/frame/cclio/script/pocket-check.ts" 2>&1); then
  echo "$out"
elif [ -n "$out" ] && [ -z "$(printf '%s\n' "$out" | grep -v '^🔴 ')" ]; then
  echo "🔴 $(printf '%s\n' "$out" | wc -l | tr -d ' ') items off contract — \`node ~/frame/cclio/script/pocket-check.ts\` lists them"
  printf '%s\n' "$out" | sed 's/^🔴 [^:]*: //' | sort | uniq -c | sort -rn | head -5
else
  fail "pocket-check could not run: $(printf '%s' "$out" | head -1)"
fi
echo "now: $(BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain --priority now 2>/dev/null | grep -c 'PK-') · ready: $(BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain --ready 2>/dev/null | grep -c 'PK-')"
for f in "$HOME"/frame/cclio/pocket/tasks/*.md; do
  grep -q '^status: waiting' "$f" || continue
  awk '/^id: /{id=$2} /SECTION:DESCRIPTION:BEGIN/{getline; print "⏸️ " id " · " $0; exit}' "$f"
done

echo "-- flawlog (the day's file; the 🥊 pair rides the CST) --"
today="$HOME/.claude/shelf/flawlog/$(date +%Y-%m-%d)"
ls "$today"-*.md >/dev/null 2>&1 && echo "today's file exists" || echo "no file for today yet — open one at step 8"

date +%s > "$STAMP"
if [ "$fails" -gt 0 ]; then
  echo "=== $fails check(s) FAILED — report them first, before any work ==="
  [ -n "$BOOT_STRICT" ] && exit 1
else
  echo "=== all checks green ==="
fi
exit 0
