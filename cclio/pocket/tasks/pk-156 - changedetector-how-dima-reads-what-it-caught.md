---
id: PK-156
title: 'changedetector: how dima reads what it caught'
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-16 11:12'
due_date: '2026-10-16'
labels:
  - xs
dependencies: []
priority: next
type: question
ordinal: 10104
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-16, Q: how does he see what it caught himself — does an entry in the web ui turn bold? 5 bold items since yesterday: ~5 updates to watched gh issues? relates PK-144 (a board over its api).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 10-16: bold = a watch whose last_changed is newer than last_viewed (api: 33 watches, exactly 5 unviewed). the 5: the claude-code releases feed + 4 issues (#99217, #91870, #88813, #99395) — the issues gained comments (digest: #88813 2→3, #99217 7→9, #99395 7→8). opening a watch's diff in the web ui clears its bold.

correction 10-16: «opening a watch's diff clears its bold» is an inference, unprobed.
<!-- SECTION:NOTES:END -->
