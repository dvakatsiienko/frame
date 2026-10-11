---
id: PK-52
title: 'mods engine gaps — dima''s mods wants cc can''t do yet, watched until each lands'
status: waiting
assignee: []
created_date: '2026-10-10 19:37'
updated_date: '2026-10-11 21:30'
due_date: '2026-10-17'
labels:
  - s
dependencies: []
priority: later
type: wish
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** each gap closing upstream; re-checked at every refresh-cc-mods run and at the 10-17 due date

dima, 2026-10-10 22:34 (via the mods coder): his mods wants the engine can't do yet. the full entries (want, workaround, undo) live in `home/.claude/plugin-x/mods/workarounds.md`; this item only keeps them in front of cclio.

1. full-width, multi-line note Input on the desktop — https://github.com/anthropics/claude-code/issues/101089 (workaround: the note shares the button row)
2. selectable mod text for F4 — https://github.com/anthropics/claude-code/issues/101090 (workaround: 🔊 ⏯ ⏹ through x-speak)
3. links that open desktop apps (linear://) — no issue filed yet; Link takes https only, a Button can't sit inside Text
4. a board button acts on the first click — https://github.com/anthropics/claude-code/issues/99395 (first click only focuses)
5. hover cards inside a pane (his «1 open ask for you» on a board row) — cards draw over neighbours in a Pane; no issue named yet
6. mods drawing on mobile and remote control (in desktop app too — app + terminal) — https://github.com/anthropics/claude-code/issues/99217 (why /mobile-mode exists)
7. no svg flicker when the board redraws — https://github.com/anthropics/claude-code/issues/100797 (breather blinks while the board is open)

- 5–7 are not in workarounds.md yet: the mods coder adds them
- the upstream issues join the boot digest's gh watch (o72)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-12: more space in the board view (dima 00:29) — he tried it with the coder; the mods api is too barebones to allow it, kept as is until it lands upstream (dima 00:30, o306)
<!-- SECTION:NOTES:END -->
