---
id: PK-52
title: 'mods engine gaps — dima''s mods wants cc can''t do yet, watched until each lands'
status: done
assignee: []
created_date: '2026-10-10 19:37'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
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
3. ~~links that open desktop apps (linear://)~~ — dropped, dima 21:32: https everywhere, his Hyper+G opens the apps only, a Button can't sit inside Text
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

for the next refresh-cc-mods run's step 0 (mods coder's verdict on run #4, 21:40): useful — the researcher lane alone found a real loss path it had shipped (quiet's swallowed saves), api-map named every door used; noise — exa/parallel's local analysis. its proposal: add a pass that greps our own mods for the failure patterns the research finds, and a tool schema-vs-ops check per mod (today's catch-clear bug was one); cut the local-analysis vectors from exa/parallel

2026-10-15 re-checked: #101089, #101090, #99395 all still open, no news since 10-13; next look at the refresh-cc-mods run.
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved to FRM-304 — folded under «from the pocket» (0 of 0 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
