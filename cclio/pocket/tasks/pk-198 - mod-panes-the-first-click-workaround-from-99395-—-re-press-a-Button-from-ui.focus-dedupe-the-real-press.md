---
id: PK-198
title: >-
  mod panes: the first-click workaround from #99395 — re-press a Button from
  ui.focus, dedupe the real press
status: waiting
assignee: []
created_date: '2026-10-19 12:39'
updated_date: '2026-10-19 12:40'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 120500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it rides that lane's next chunk.
upstream https://github.com/anthropics/claude-code/issues/99395 (desktop: the first click on a plugin pane button only moves focus). beatwiz's workaround (comment 10-19): a dropped click still raises ui.focus with origin person and the Button's key; call that Button's press from the ui.focus hook after ~150 ms if no real press came, drop a duplicate real press within ~500 ms; $.ui.focus right after $.ui.open gives the pane the keyboard. ours: x-mod-stash routes every press through one ui.press handler (hooks/register.tsx ~3508), so the fix is one ui.focus hook + a dedupe, plus tests. size s, not a freebie: a mods change with tests.
<!-- SECTION:DESCRIPTION:END -->
