---
id: PK-36
title: 'the plugin monitors run as one-shot background watches, never a 30-min Monitor'
status: open
assignee: []
created_date: '2026-10-09 11:47'
due_date: '2026-10-09'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow 2026-10-09 14:46: pr-watch + ci-watch were re-armed by hand five times today, each a reply to dima reprinting the ⏳ bucket; the Monitor cap is 30 min by design, so ~16 empty turns a day. stopgap live this session: scratchpad watch-once.sh runs a --watch hook until its first event line or 6 h, under Bash run_in_background, so only a real event wakes a turn.
- move watch-once.sh into cclio/.claude/hooks/ beside the watchers
- the boot skill's 📡 line arms it that way (plugin bump + dima's /reload-plugins)
- an event wake re-arms once after handling, silently; a no-event end is never a reply to dima
- ccrow's bigger move, for later: one loop outside cc (launchd or an x verb) that sends to cclio's socket only on an event, like ccrow:wake's sendLine
<!-- SECTION:DESCRIPTION:END -->
