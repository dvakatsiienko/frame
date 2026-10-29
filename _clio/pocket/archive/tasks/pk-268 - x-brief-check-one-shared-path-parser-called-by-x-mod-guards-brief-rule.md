---
id: PK-268
title: 'x brief check: one shared path parser, called by x-mod-guard''s brief rule'
status: done
assignee: []
created_date: '2026-10-23T18:41:00Z'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** a cli lane chunk (it needs one before FRM-428 can lean on it)
the brief rule's false «no such path» on `Explore.md`, `/clear` and branch names (mods scope G12) needs a real path parser, and `x brief check` needs the same one; dima's o174 moved it to the cli lane, the guard calls `x brief check`.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-439
close: moved to FRM-439, its wish block carries them (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
