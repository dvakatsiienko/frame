---
status: adopted
until: 2026-10-24
dies-when: the verdict line below is written
---

# 🔭 x-changedetector — changedetection.io under launchd, the one place that watches what we follow upstream

Ticket: none

born 2026-10-15 on dima's ask (PK-136): `schedule/jobs/x-changedetector/` (127.0.0.1:7390, data in
`~/.local/share/x-changedetector/data`), installed with `uv tool install changedetection.io --python 3.12`. the research:
`_clio/.scratch/research-watcher/` (3 lanes; parallel's monitors caught 1 of 6 events on 09-27, the bar).

**test card:** we believe one local watcher replaces the boot's gh watch, the release reminders and dima pasting links ·
we test it by every github issue we follow (52 open, gathered from our files, the boot list, issues dima filed or
commented, his subscriptions) as api json filtered to state, reason, labels, comment count and closed_at, every 6 h
with 30 min jitter and no token (github's anonymous budget is 60 an hour per machine), plus release feeds · we measure caught vs missed against the boot's gh watch, latency from the real event,
false alarms, github rate-limit errors · we're right if it catches every event the gh watch catches, with no rate-limit
error, over 7 days

**kill rule:** a real event missed that the gh watch caught · rate-limit errors two days running

## stress list

- a close, a label, a comment on one issue — the positive control on a test issue of ours
- a release — `MrLesk/Backlog.md` releases.atom (1.54 expected), `anthropics/claude-code` releases.atom
- the agent's read — `GET /api/v1/watch`, `last_changed` vs `last_viewed`, in one call at boot
- a push channel — apprise to a macOS notification or ntfy (untried)
- a plain page — a changelog or pricing page (untried)

## rounds

- 2026-10-15 · seed · 54 watches (52 issues + 2 release feeds), all checked within ~1 min · then 40 went red with 403: the seed burst plus a recheck spent the anonymous 60/h · fix: 6 h interval, 30 min jitter, 2 workers (~9 calls an hour) · renamed x-watcher → x-changedetector on dima's word

- 2026-10-15 · positive control on frame#87 · ✅ 3 of 3 caught: labels [] → [bug], comments 0 → 1 → 2, state open → closed (completed) · each caught on its next check; github caches an anonymous api answer ~60 s, so a check inside that window sees the old state · `link_to_open` set on every github watch, «go to page» opens the github page · the 5 audiophile watches dropped (dima)

- 2026-10-15 · the token · `dev/github-changedetector` (fine-grained, public read-only, no permissions) set as a header on the 38 github api watches, hourly · a recheck of all 40: 0 errors, the anonymous budget untouched (36/60) · dima pruned 7 watches by hand

- 2026-10-15 · the watch review (PK-146) · 37 → 33 on dima's word: claude-code#97924 (Projects, unused), #92327 (skill-doctor numbers), #87113 (stacked slash-skills, never hit), superwhisper-claude-code#16 (not his voice path) · #91870, the 260-comment mods umbrella, now watches state, reason, labels and closed_at, no comment count · all 35 watched issues were open at the review
- 2026-10-21 · a page watch for an outage (the no man's sky wiki on miraheze, down for a php patch, eta 15:00 utc) · 1 call, 1 s, the wiki answered 503 at add time · the usual door was dima re-opening the page by hand · and the first hook on top of the trial: `watch-nudge.ts` reads cclio's prompt for an unwatched github issue or pr, proven by piping a prompt into the script (a watched issue skipped, a probe link nudged); widened the same day to any web page, our own surfaces skipped; the harness firing it on a real prompt is not yet seen

## verdict
- 2026-10-22 · **adopted** (dima's o33): 45 watches read at every boot, 0 real events missed against the gh watch, 0 rate-limit days; today 11 changes read, 1 watch retired, 1 added
