---
id: PK-222
title: >-
  research skill to every surface: move cclio:research → x:research, symlink it
  into plugin-x-cw
status: done
assignee: []
created_date: '2026-10-20 16:14'
updated_date: '2026-10-20 16:19'
due_date: '2026-10-21'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima o68 ✓ 2026-10-20: one skill usable by everyone — a coder, a plain thread, a cw thread — still shaped for cclio as its main user. the move: plugin-x/skills/research/SKILL.md, cclio-only lines (one reply per fan-out, the print shape, recipe-first) under a «when cclio runs it» section; cw reaches it by «ln -s ../../plugin-x/skills/research» in home/.claude/plugin-x-cw/skills/ + a bump of both plugins (author-memory references/skill.md); cw runs pnpm research:lanes through Desktop Commander on the mac. every cclio:research pointer reworded (rg). NOT through memory-sync: that pastes resident memory, never skills (dima caught it, 19:13).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:20 done: x:research (plugin-x 0.11.348), symlinked into plugin-x-cw (0.2.43, pushed — the desktop app pulls x-com from github), cclio:research retired, 11 pointers reworded; cclio 0.3.240. cw proof: dima checks the desktop plugin listing.
<!-- SECTION:NOTES:END -->
