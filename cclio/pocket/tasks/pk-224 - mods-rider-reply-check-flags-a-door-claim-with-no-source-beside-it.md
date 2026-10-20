---
id: PK-224
title: 'mods rider: reply-check flags a door claim with no source beside it'
status: waiting
assignee: []
created_date: '2026-10-20 16:56'
updated_date: '2026-10-20 17:34'
due_date: '2026-10-31'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).
halt flush 2026-10-20 (dima's yes, o81): 9 #unchecked-source flawlog lines in one day, each fixed by «read first». the check: a reply claiming how a door works (a sync, a plugin path, a tool's auth or limit) carries the file:line or doc link it was read from in the same reply; reply-check (x-mod-stash) flags one without it. **waiting for:** the mods lane (PK-120).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima o85 ✓ 2026-10-20: first in the mods lane; once it ships, delete the three «read first» intention lines it replaces (method-report-verify's capability line, habit-dima-comms's remove rule, this rider).
<!-- SECTION:NOTES:END -->
