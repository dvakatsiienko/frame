---
id: PK-39
title: ccrow keeps its pin without dima's hand
status: open
assignee: []
created_date: '2026-10-09 12:16'
due_date: '2026-10-09'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-06 (only in docs/test-drive/ccrow.md, found by the 10-09 leak sweep): «i have to pin each time? not good, can this be automated?» — the arm switch restarts the ccrow job, so the desktop pin and an idle-stopped resume on a socket line are unproven
- probe: does the pin survive an arm switch, does an idle-stopped ccrow resume on a socket line
- if not: ccrow:start pins its own card (mcp__ccd_sidebar__set_pinned) after every start
<!-- SECTION:DESCRIPTION:END -->
