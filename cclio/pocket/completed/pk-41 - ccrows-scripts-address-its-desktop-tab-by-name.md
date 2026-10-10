---
id: PK-41
title: ccrow's scripts address its desktop tab by name
status: done
assignee: []
created_date: '2026-10-09 13:05'
updated_date: '2026-10-09 14:12'
labels:
  - m
dependencies:
  - PK-39
priority: next
type: task
ordinal: 10300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pk-39 probes 10-09: ccrow now lives in dima's desktop tab (pinned by cclio, wakes reach it in bypass mode, set_session_model switches the arm; clear_session refuses a pinned RC tab, so dima /clears it at the halt). left: ccrow start/ensure/wake address the tab by name, not a --bg job id; the stash keep-hot key moves to the tab's session; copyRules() stops writing ~/.local/state/ccrow/.claude/rules in desktop mode (the tab loads user rules too → every wake loads 9 rules twice) and the stale copy goes on dima's word; boot step 2 (true &) is refused by the guard, reword it
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 16:11: 🔥 must not need his hand. plan: a SessionStart hook in ccrow's own project settings (~/.local/state/ccrow/.claude/settings.json) runs a tiny ccrow entry that calls lib.ts setHot(store, <the hook's session_id>, now) — it fires on startup, resume and /clear, so a restarted or cleared tab re-arms itself; nothing in user settings, so no other session goes hot. unproven: SessionStart's clear source in a desktop tab

check: dima's word on trashing ~/.local/state/ccrow/.claude/rules (10 copied rules, loaded twice by the tab). done 10-09 17:1x: findSession by name (the stale jobId sent the 16:18 wake to the stopped --bg ccrow), ccrow:ensure arms 🔥 on the tab (key written, proven), no --bg auto-start, stale jobId cleared, AGENTS + boot line reworded; boot (true &) was already gone. proof pending: the next wake logs 'note logged' in harvest.log

rules copy trashed 17:11 on dima's word
<!-- SECTION:NOTES:END -->
