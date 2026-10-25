---
id: PK-163
title: >-
  shared verify-kit lib: lift the state backup/restore + admin login steps out
  of the per-app kits
status: done
assignee: []
created_date: '2026-10-16 12:32'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-30'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the speak v2 coder lane, when speak's verify kit is next touched.

app-setup-essentials § verify kits: «the step moves to the shared lib on the next kit touched» (2nd sighting 2026-09-29, speak's admin snapshot + restore). design-loupe got a kit (apps/design-loupe/.claude/skills/design-loupe-verify/kit.sh) without the lib. dima (o44, 2026-10-16) asked: «Is this related to a designer? I think the nearest design stuff will be related to Speak app because we already prepped everything for Speak app v2, but there are some tails we need to settle: the design, finalize it, and actually implement.» cclio's answer: not designer work — a kit is a coder's test script; cclio's call is that it rides the speak v2 coder lane, when speak's verify kit is next touched.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: moved to FRM-289 — folded under «from the pocket» (0 of 0 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
