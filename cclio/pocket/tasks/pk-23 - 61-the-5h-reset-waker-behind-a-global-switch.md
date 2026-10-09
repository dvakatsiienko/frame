---
id: PK-23
title: '[61] the 5h reset waker, behind a global switch'
status: open
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 11:35'
labels:
  - m
dependencies: []
priority: next
type: grill
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 61 · status line was: open · grilled 10-09 · ticket under FRM-304 at the next mods lane

- dima, 2026-10-09: the `--bg` coders slept past the window's return until cclio nudged them. at a reset x-mod-stash sends one «resume» to every member that stopped on the cap — «I kind of agree if it is easy, but I don't want this to be permanent … it has to be gated behind a button, like the hot button in a mod, but global. a redundant trigger gate.»
- detectable: stash already reads `five_hour` from `session.measure` (`x-mod-stash/hooks/register.tsx:882`), so a reset is a resets-at move it sees
- off by default; on only by his click; a member not stopped on the cap gets nothing
<!-- SECTION:DESCRIPTION:END -->
