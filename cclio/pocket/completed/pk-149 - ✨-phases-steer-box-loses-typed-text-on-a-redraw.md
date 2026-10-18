---
id: PK-149
title: ✨ phases steer box loses typed text on a redraw
status: done
assignee: []
created_date: '2026-10-15 17:16'
updated_date: '2026-10-18 16:39'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima, 2026-10-16: cc 2.1.301 added `rows` to a mod's Input (a multi-line text field; Enter submits, Shift+Enter or a backslash before Enter starts a new line). the coder tests rows on the steer box — it may fix the lost text, and the mods' text inputs that are too small today.

19:39 landed on main (mods coder, unpushed): the orbit plan op dropped plan.steer, so a phases refresh cleared the typed steer and remounted the field; the op keeps it now, test red on HEAD, stash 701/0. not checked: dima typing in the desktop box. open edge: absorbMarks (register.tsx:1013) may do the same to the ask steer box — a P4 line in the mods scope.
<!-- SECTION:NOTES:END -->
