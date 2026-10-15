---
id: PK-149
title: ✨ phases steer box loses typed text on a redraw
status: waiting
assignee: []
created_date: '2026-10-15 17:16'
updated_date: '2026-10-15 17:16'
due_date: '2026-10-24'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it opens after the memory sweep
dima, 2026-10-15: when I type into the steer text box in the phases mod, it loses text at certain times — I think somewhere during redraws. I type, at some point the caret jumps and deletes parts of what I already typed. sometimes it comes back, sometimes not; the not-restored case is not good at all. a coder fixes it in the next mods lane (PK-120). repro: x-mod-stash phases panel, type a long steer slowly while cclio's turn redraws the board.
<!-- SECTION:DESCRIPTION:END -->
