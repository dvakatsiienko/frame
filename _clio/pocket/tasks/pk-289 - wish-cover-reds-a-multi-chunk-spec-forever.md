---
id: PK-289
title: wish-cover reds a multi-chunk spec forever
status: done
assignee: []
created_date: '2026-10-30T17:13:00Z'
updated_date: '2026-11-01T12:57:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
the wish-cover hook checks every W-line of a multi-section spec against the file's first wish: line only, so a lane spec with several chunks (mods-lane-3, cli-3) reds on every write. from the 10-30 halt flush; tomorrow's main lane, a clio script fix
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
kept: 2026-11-01 — clio's script fix, queued behind the pm module (dima's order)

close: 2026-11-01 — already fixed: the hook checks every wish: id against its own section; proven on a two-chunk .scratch spec, green when copied, red on a reworded W798 in chunk 2
<!-- SECTION:NOTES:END -->
