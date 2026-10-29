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
# PK-152's done test needs a real /clear: until it closes, a cleared session says so on its first line
if [ "$(printf %s "$in" | jq -r '.source // empty' 2>/dev/null)" = clear ] && grep -qs '^status: waiting' "$HOME"/frame/cclio/pocket/tasks/pk-152\ *; then
  echo "🧪 PK-152 test is live: this session began with a /clear — a pr-watch or ci-watch notice that wakes this context in the next 6 h is the bug; silence until then closes PK-152. tell dima, and log the outcome in PK-152."
fi

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
else
  fail "inbox unreadable (icloud not mounted?)"
fi

# the resident roadmap outline, refreshed in both modes: memory/_roadmap.md rides the barrel import
"$HOME/frame/cclio/.claude/hooks/roadmap-prefetch.sh" --outline > /dev/null

if [ -z "${COMPACT:-}" ]; then
echo "-- jev vet (pnpm jev:vet ok|miss <flow> <note> records a verdict; a miss restarts the window) --"
node "$HOME/frame/script/jev-vet.ts" 2>/dev/null || fail "jev vet registry unreadable"
health=$(timeout 15 "$HOME/frame/script/op-run.sh" node "$HOME/frame/script/jev-report.ts" --health 2>&1) && echo "jev health: $health" || fail "jev: ${health:-probe did not run}"

"$HOME/frame/cclio/.claude/hooks/gazette-trail.sh"
echo "-- gazette trail (the 5 freshest posts; no longer a memory import) --"
sed '1d' "$HOME/frame/cclio/gazette/_trail.md"

roadmap=$("$HOME/frame/cclio/.claude/hooks/roadmap-prefetch.sh")
if echo "$roadmap" | grep -q '^-- scope'; then
  echo "$roadmap"
else
  fail "tracker unreachable — roadmap prefetch returned nothing (linear auth or network)"
fi

fi

echo "-- stuck reminders (raise every one in the opening board) --"
reminders="${REMINDERS_FILE:-$HOME/frame/cclio/memory/_reminders.md}"
grep '^⏰📌' "$reminders" 2>/dev/null || echo "none"

echo "-- due reminders (a plain ⏰ line whose \`due:\` date has come; raise each in the opening board) --"
# a dated ⏰ line sat silent past its date until a groom read the file (NPSSO, 2026-10-11)
today=$(date +%F)
due_lines=$(grep '^⏰' "$reminders" 2>/dev/null | grep -v '^⏰📌' | while IFS= read -r line; do
  d=$(printf '%s' "$line" | grep -o 'due: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | head -1 | cut -c6-)
  [ -n "$d" ] && [[ ! "$d" > "$today" ]] && printf '%s\n' "${line:0:220}"
done)
[ -n "$due_lines" ] && echo "$due_lines" || echo "none"
# a dated ⏰ line with no due: field would sit silent forever
while IFS= read -r line; do
  grep -qE '^⏰ [^ ]+ [0-9]{4}-[0-9]{2}-[0-9]{2}:' <<<"$line" && ! grep -qE 'due: [0-9]{4}-[0-9]{2}-[0-9]{2}' <<<"$line" &&
    fail "reminder with a date and no due: field: ${line:0:80}"
done < <(grep '^⏰' "$reminders" 2>/dev/null | grep -v '^⏰📌')

echo "-- fleet: live sessions · worktrees · coder prs --"
# the name is what SendMessage and the board use; a cwd count alone hid a peer editing frame (2026-09-27)
# a lane coder's desktop thread (a mods coder) is cclio's, archived at its lane's end; any other interactive non-cclio session is dima's: 👤, never on a stop list.
# the rest of the fleet (coders, verifiers, probes) is spawned with --bg; ccrow is a desktop tab the halt stops, matched by name
live=$(jq -r '"\(.cwd // "?") · \(.name // "unnamed") · \(.entrypoint // .kind // "?")\(if (.name // "") | test("ccrow") then " · the fleet'"'"'s — the halt stops her" elif (.name // "") | test("^(⚡|🌗|🌘) .* code:") and (.entrypoint // "") == "claude-desktop" then " · a lane coder cclio started — archived at its lane'"'"'s end" elif .kind == "interactive" and ((.name // "") | test("cclio") | not) then " · 👤 dima'"'"'s — never stop" else "" end)"' "$HOME"/.claude/sessions/*.json 2>/dev/null | sort)
[ -n "$live" ] && echo "$live" || echo "no live sessions registered"
wt=$(git -C "$HOME/projects/bytes" worktree list 2>/dev/null | grep -v '^/Users/dima/projects/bytes ' )
[ -n "$wt" ] && echo "$wt" || echo "no bytes worktrees"
for repo in bytes frame; do
  prs=$(gh pr list -R "dvakatsiienko/$repo" --search 'head:coder/' --json number,title,headRefName --jq '.[] | "#\(.number) \(.headRefName) — \(.title)"' 2>/dev/null) || { fail "gh unreachable for $repo"; continue; }
  [ -n "$prs" ] && echo "$repo coder prs: $prs" || echo "$repo: no open coder prs"
done

if [ -z "${COMPACT:-}" ]; then
echo "-- renovate + the apps lane (cclio:evergreen) --"
for repo in bytes frame; do
  gh pr list -R "dvakatsiienko/$repo" --search 'author:app/x-renovate' --json number,createdAt 2>/dev/null \
    | jq -r --arg r "$repo" 'if length == 0 then "\($r): 0" else "\($r): \(length) open · oldest \(min_by(.createdAt).createdAt[:10])" end' \
    || fail "gh unreachable for renovate/$repo"
  # renovate runs hourly and touches its dashboard every run; a stale one means it stopped
  # (Mend sat silent on bytes 10-13 → 10-28, and the digest read the silence as quiet)
  dash=$(gh issue list -R "dvakatsiienko/$repo" --author app/x-renovate --search 'Dependency Dashboard' --json updatedAt 2>/dev/null | jq -r 'max_by(.updatedAt).updatedAt // empty')
  if [ -z "$dash" ]; then
    fail "renovate/$repo: no x-renovate dashboard — renovate never ran there"
  elif [[ "$dash" < "$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)" ]]; then
    fail "renovate/$repo: dashboard last touched $dash — renovate stopped (gh run list -R dvakatsiienko/$repo -w renovate)"
  fi
done
apps_line=$(jq -r --arg today "$(date +%Y-%m-%d)" '(map(.markedAt) | max) as $m
  | ($today | strptime("%Y-%m-%d") | mktime) as $t
  | ((10 - ($t | strftime("%u") | tonumber)) % 7) as $days
  | "apps lane: \(length) apps · last marked \($m) · " + (if $days == 0 and $m < $today then "DUE today" else "next run wednesday \($t + (if $days == 0 then 7 else $days end) * 86400 | strftime("%Y-%m-%d"))" end)' \
  "$HOME/frame/cclio/evergreen/sources.json") || fail "apps lane index unreadable"
echo "$apps_line"
security=$(gh pr list -R dvakatsiienko/frame --search 'author:app/x-renovate SECURITY in:title' --json number --jq length 2>/dev/null)
security=$((security + $(gh pr list -R dvakatsiienko/bytes --search 'author:app/x-renovate SECURITY in:title' --json number --jq length 2>/dev/null || echo 0)))
# the board's order is the pocket's, so an evergreen day is a pocket item on top or it gets dropped (10-07, 10-14, 10-21)
if [[ "$apps_line" == *"DUE today"* || "$security" -gt 0 ]]; then
  seeded() { BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain -s open 2>/dev/null | grep -q '🧬 evergreen turn'; }
  if seeded; then
    echo "🧬 evergreen turn: on top of the pocket — turn 2 is evergreen (cclio:evergreen)"
  else
    # pocket-add exits 1 when its trailing pocket-check is red for any item, so the seed is judged by the pocket
    node "$HOME/frame/cclio/script/pocket-add.ts" "🧬 evergreen turn — $(date +%Y-%m-%d)" --priority now --top --size xs --due "$(date +%Y-%m-%d)" -d "seeded by the boot digest: apps lane due or $security security PR(s). run cclio:evergreen; done when its § the day completes." >/dev/null 2>&1
    seeded && echo "🧬 evergreen turn: seeded on top of the pocket — turn 2 is evergreen (cclio:evergreen)" || fail "evergreen turn: pocket-add wrote nothing"
  fi
fi
last_checkup=$(grep -v ' · postponed · ' "$HOME/frame/cclio/checkup/log.md" 2>/dev/null | grep -oE '^- [0-9]{4}-[0-9]{2}-[0-9]{2}' | cut -c3- | sort | tail -1)
postponed_to=$(grep ' · postponed · ' "$HOME/frame/cclio/checkup/log.md" 2>/dev/null | grep -oE 'next due [0-9]{4}-[0-9]{2}-[0-9]{2}' | cut -c10- | sort | tail -1)
if [ -n "$postponed_to" ] && [[ "$postponed_to" > "$(date +%F)" ]]; then
  echo "checkup: last run ${last_checkup:-never} · postponed until $postponed_to"
elif [ -z "$last_checkup" ]; then
  echo "checkup: never run · DUE — offer cclio:system-checkup on the board"
elif [ $(( ( $(date +%s) - $(date -j -f %Y-%m-%d "$last_checkup" +%s) ) / 86400 )) -ge 7 ]; then
  echo "checkup: last run $last_checkup · DUE — offer cclio:system-checkup on the board"
else
  echo "checkup: last run $last_checkup"
fi

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

echo "-- n8n tables (blueprints trial: 🔴 ci watch rows unseen, 🎼📬 composer receipts of the last day) --"
# the ci watch polls frame + bytes main every 5 min under pm2 (x-n8n); its rows replace a watch the boot has to re-arm
if n8n_out=$(timeout 30 ~/frame/script/op-run.sh bash -c '
  set -eo pipefail
  get() { curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" "http://${N8N_HOST:-localhost:5678}/api/v1/data-tables/$1/rows"; }
  get vZqYjgJqtQTWc9s9 | jq -r ".data[] | select(.seen != true) | \"🔴 \(.repo) · \(.workflow) · \(.failed_at) · \(.url)\""
  get voy4TaHqBxTY6RWJ | jq -r --arg since "$(date -u -v-1d +%Y-%m-%dT%H:%M)" ".data[] | select(.createdAt > \$since) | \"📬 \(.batch) · \(.chore) · \(.result) · \(.sender)\""
' 2>&1); then
  printf '%s\n' "${n8n_out:-no unseen ci reds, no receipts in a day}"
else
  fail "n8n tables unreadable (x-n8n down? pm2 ls): $(printf '%s' "$n8n_out" | tail -1)"
fi

# a project-scope plugin starts no monitors (code.claude.com/docs/en/plugins/loading, «Background monitors do not load»), so the boot arms both every time; n8n's ci rows above are the record, ci-watch is the wake, until an n8n → mod bridge lands
watches=$(ps -ax -o command | grep -c '[p]r-watch.sh --watch\|[c]i-watch.sh --watch' || true)
echo "watches: $watches of 2 running — the boot arms the missing ones (watch-once.sh), as every boot does"

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
# the fetches run 8 at a time (27 links one by one took 17 s of a 44 s boot, first system checkup 10-19)
gh_now=$(printf '%s\n' "$gh_urls" | grep . | xargs -P 8 -I{} sh -c '
  api=$(printf "%s" "$1" | sed -E "s#https://github.com/([^/]+)/([^/]+)/(issues|pull)/([0-9]+)#repos/\1/\2/issues/\4#")
  now=$(timeout 10 gh api "$api" --jq "[.state, (.state_reason // \"\"), (.pull_request.merged_at // \"\"), ([.labels[].name] | join(\",\")), (.comments | tostring)] | join(\" · \")" 2>/dev/null) && printf "%s\t%s\n" "$1" "$now"
' _ {})
while IFS=$'\t' read -r url now; do
  [ -z "$url" ] && continue
  gh_ok=$((gh_ok + 1))
  gh_state="$gh_state$url	$now
"
  before=$(awk -F'\t' -v u="$url" '$1 == u { print $2 }' "$GH_SEEN")
  if [ "$before" != "$now" ]; then
    gh_changed=$((gh_changed + 1))
    echo "🐙 $url — ${before:-new} → $now"
  fi
done <<< "$gh_now"
gh_total=$(printf '%s\n' "$gh_urls" | grep -c .)
if [ "$gh_ok" -lt "$gh_total" ]; then
  fail "gh watch: $gh_ok of $gh_total links answered"
fi
if [ "$gh_ok" -gt 0 ]; then
  printf '%s' "$gh_state" > "$GH_SEEN"
  if [ "$gh_changed" -eq 0 ]; then echo "$gh_ok watched, no change"; fi
fi

echo "-- x-changedetector (changed since last viewed; the key is the app's own, read from its datastore) --"
CD_STORE="$HOME/.local/share/x-changedetector/data/changedetection.json"
cd_key=$(jq -r '.settings.application.api_access_token // empty' "$CD_STORE" 2>/dev/null)
if cd_json=$(timeout 10 curl -sf -H "x-api-key: $cd_key" http://127.0.0.1:7390/api/v1/watch); then
  printf '%s' "$cd_json" | jq -r '[to_entries[].value] as $w
    | ($w | map(select((.last_changed // 0) > (.last_viewed // 0)))) as $c
    | ($c[] | "🔭 \(.title // .url) — \(.url | sub("api.github.com/repos/"; "github.com/"))"),
      "\($w | length) watched, \($c | length) changed since last viewed"'
else
  fail "x-changedetector: GET /api/v1/watch failed (app down, or the key in $CD_STORE moved)"
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
  args=$(ps -o args= -p "$pid" 2>/dev/null)
  case "$args" in claude\ *|*/bin/claude\ *|*/bin/claude|*/versions/[0-9]*|*/claude-code/[0-9]*) born=$(ps -o lstart= -p "$pid"); age=$(ps -o etime= -p "$pid" | tr -d ' '); break;; esac
done
# the running build, read from its own path: the desktop app bundles its own cc, so `claude --version` names the cli's, not this one
ver=$(printf '%s' "$args" | grep -oE '(claude-code|versions)/[0-9]+\.[0-9]+\.[0-9]+' | head -1 | cut -d/ -f2)
[ -n "$born" ] && echo "process $pid up ${age} (since ${born}) · cc ${ver:-unknown}" || echo "process: not found in the parent chain"
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

echo "-- test drives (pnpm test-drive:check; a red runs cclio:shape-test-drive § 4) --"
if out=$(node "$HOME/frame/script/test-drive-list.ts" --check 2>&1); then
  echo "$out"
elif printf '%s\n' "$out" | head -1 | grep -q '^test-drive:check:'; then
  printf '%s\n' "$out" | head -1
  echo "🔴 $(printf '%s\n' "$out" | grep -c '^🔴') off contract:"
  printf '%s\n' "$out" | grep '^🔴' | head -6
else
  fail "test-drive:check could not run: $(printf '%s' "$out" | head -1)"
fi

echo "-- pocket (Backlog.md, cclio/script/pocket-check.ts; a red is drift to fix today, not a broken boot) --"
if out=$(node "$HOME/frame/cclio/script/pocket-check.ts" 2>&1); then
  echo "$out"
elif [ -n "$out" ] && [ -z "$(printf '%s\n' "$out" | grep -vE '^(🔴|🟡) ')" ]; then
  # a 🟡 line is a note beside the reds (linear not read), never a red of its own
  echo "🔴 $(printf '%s\n' "$out" | grep -c '^🔴 ') items off contract — \`node ~/frame/cclio/script/pocket-check.ts\` lists them"
  printf '%s\n' "$out" | head -5
else
  fail "pocket-check could not run: $(printf '%s' "$out" | head -1)"
fi
echo "now: $(BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain --priority now 2>/dev/null | grep -c 'PK-') · ready: $(BACKLOG_CWD="$HOME/frame/cclio" backlog task list --plain --ready 2>/dev/null | grep -c 'PK-')"
for f in "$HOME"/frame/cclio/pocket/tasks/*.md; do
  grep -q '^status: waiting' "$f" || continue
  awk '/^id: /{id=$2} /SECTION:DESCRIPTION:BEGIN/{getline; print "⏸️ " id " · " $0; exit}' "$f"
done

echo "-- linear queues (signed = waiting for a lane; the list JSON carries no updatedAt, so no age; to sign needs a body read per ticket: n/a) --"
dispatch=0 list_err=""
for team in FRM BYT; do
  if listed=$(timeout 20 x linear list --team "$team" --label signed 2>&1); then
    dispatch=$((dispatch + $(printf '%s' "$listed" | jq '[.data.tickets[] | select(.stateType != "completed" and .stateType != "canceled" and .stateType != "started")] | length' 2>/dev/null || echo 0)))
  else
    list_err="$team: $(printf '%s' "$listed" | tail -1 | cut -c1-120)"
  fi
done
[ -z "$list_err" ] && echo "✍️ to sign: n/a · 🚀 to dispatch: $dispatch" || fail "linear queues: could not read — $list_err"
if back=$(timeout 20 x linear api 'query { issues(filter:{state:{type:{in:["unstarted","backlog","triage"]}}, description:{contains:"↩️ back to Todo"}}) { nodes { identifier description } } }' 2>&1) && ids=$(printf '%s' "$back" | jq -r '.data.issues.nodes | map(select((.description | split("\n")) as $l | ([$l | to_entries[] | select(.value | contains("↩️ back to Todo")) | .key] | max) as $at | $l[$at + 1:] | any(.[]; test("✍️ (re-)?signed")) | not)) | map(.identifier) | join(", ")' 2>/dev/null); then
  echo "↩️ back to Todo: ${ids:-none}"
else
  fail "linear queues: could not read — back to Todo: $(printf '%s' "$back" | tail -1 | cut -c1-120)"
fi
# the plan's slot after the pocket: the main lane's open tickets (body opens `lane: main`), top milestone first
if main_lane=$(timeout 20 x linear api 'query { issues(first: 50, filter:{state:{type:{nin:["completed","canceled"]}}, description:{startsWith:"lane: main"}}) { nodes { identifier projectMilestone { name sortOrder } } } }' 2>&1) && main_ids=$(printf '%s' "$main_lane" | jq -r '.data.issues.nodes | sort_by(.projectMilestone.sortOrder // 1e9) | map("\(.identifier) (\(.projectMilestone.name // "no milestone"))") | join(", ")' 2>/dev/null); then
  echo "main lane: ${main_ids:-none}"
else
  fail "linear queues: could not read — main lane: $(printf '%s' "$main_lane" | tail -1 | cut -c1-120)"
fi

echo "-- flawlog (the day's file; the 🥊 pair rides the CST) --"
today="$HOME/.claude/shelf/flawlog/$(date +%Y-%m-%d)"
ls "$today"-*.md >/dev/null 2>&1 && echo "today's file exists" || echo "no file for today yet — open one at step 8"

# the starting-context digest (FRM-408): a trace that cannot be read is a note beside it, never a red of its own
init_ctx_digest() {
  local out
  if out=$(timeout 3 node "${INIT_CTX_SCRIPT:-$HOME/frame/script/ctx-init-trace.ts}" digest 2>&1); then
    printf '%s\n' "$out"
  else
    echo "🟡 init-ctx trace could not run (or took over 3 s): $(printf '%s\n' "$out" | grep -m1 -i error | cut -c1-120)"
  fi
}
echo "-- init ctx (each seat's starting context, net of its first message; pnpm ctx-init:trace) --"
init_ctx_digest

date +%s > "$STAMP"
if [ "$fails" -gt 0 ]; then
  echo "=== $fails check(s) FAILED — report them first, before any work ==="
  [ -n "$BOOT_STRICT" ] && exit 1
else
  echo "=== all checks green ==="
fi
exit 0
