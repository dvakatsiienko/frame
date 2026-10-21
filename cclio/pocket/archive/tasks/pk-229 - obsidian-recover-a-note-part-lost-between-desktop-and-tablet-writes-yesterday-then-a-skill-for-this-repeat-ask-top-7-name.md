---
id: PK-229
title: >-
  obsidian: recover a note part lost between desktop and tablet writes
  yesterday, then a skill for this repeat ask (top-7 name)
status: done
assignee: []
created_date: '2026-10-21 10:55'
updated_date: '2026-10-21T12:24:00Z'
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

2026-10-21 15:20 recovery run: the desktop file-recovery store (IndexedDB, snappy .ldb, a value never spans a block) read through a scratch reader (cramjam + a minimal sstable walk, UTF-16 decoded per block at both alignments; scratchpad obs-tool/dump.py). notes changed 10-20/21: _hq/inbox.md (6 snapshots since the reset: each a superset of the last, the newest equals today's file; «Gredos» → «Glados» was his own edit) and cooking/buckwheat.md (2 snapshots: ratio 400ml → 350ml, nothing else). verdict: nothing lost on the desktop side. the tablet keeps its own recovery store (its File recovery core plugin) — a tablet-side loss shows only there. side find: buckwheat.md opens with his ask to cc — format it via _template - recipe.md, and can that template be an obsidian built-in template. the skill: dima's top-7 pick pending.

2026-10-21 15:25 done: nothing was lost (dima: possibly a false fear). the recovery became a verb, pnpm notes-obsidian-recover (no separate skill, dima o12), pointed at from x:notes; eggs + buckwheat formatted to the recipe template, the template moved to _templates/recipe.md with templates.json pointing there.
<!-- SECTION:NOTES:END -->
