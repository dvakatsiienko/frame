---
id: PK-287
title: 'bytes: stop renovate bumping node'
status: open
assignee: []
created_date: '2026-10-30T13:10:00Z'
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
