---
id: PK-229
title: >-
  obsidian: recover a note part lost between desktop and tablet writes
  yesterday, then a skill for this repeat ask (top-7 name)
status: open
assignee: []
created_date: '2026-10-21 10:55'
updated_date: '2026-10-21T11:00:00Z'
due_date: '2026-10-24'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-21, dima, folded: yesterday i wrote a note in obsidian desktop, then another on my tablet, and afterwards some part of a note felt missing, since i wrote at different times. what to do? before, you used an obsidian trick (snapshots or similar) to recover files lost to icloud's bad sync — use it to see whether something was deleted yesterday on the desktop side. i'm asking this a second time, so make a skill of this ask, and let's top 7 its name.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
the first recovery (2026-10-13): ~/.claude/shelf/flawlog/2026-10-13-mods-relaunch.md:9 — iCloud last-writer-wins dropped the desktop edit; recovered from obsidian's file-recovery IndexedDB (snappy .ldb, UTF-16 text; `strings` misses UTF-16, a positive control caught it). the skill starts from this method.
<!-- SECTION:NOTES:END -->
