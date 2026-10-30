---
id: PK-287
title: 'bytes: stop renovate bumping node'
status: done
assignee: []
created_date: '2026-10-30T13:10:00Z'
updated_date: '2026-10-30T13:34:00Z'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W517 (2026-10-30 inbox, dima): evergreen still wants to bump node in bytes (https://github.com/dvakatsiienko/bytes/pull/136); we decided to update node ourselves when we want it, not regularly — how to stop it? ❓
close: the 4 hard node pins in bytes workflows now read .node-version (the major), pushed 10-30 (f15a2316), CI green
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
raw drop (2026-10-30 inbox, dima): **bytes evergreen** [still wants to update node](https://github.com/dvakatsiienko/bytes/pull/136) but we dicided to update it ourselves when we want it (not regularly). how to stop evergreen from bumping node?

close: W517 done — bytes workflows read .node-version (f15a2316), CI green

10-30 15:34 correction: f15a2316 fixed only 2 of the 4 pins (its edit anchor matched one of three ci.yml pins); the last two landed in bytes 9aa62d13 — 0 hard pins left, proven by grep; wishkeeper's siesta catch
<!-- SECTION:NOTES:END -->
