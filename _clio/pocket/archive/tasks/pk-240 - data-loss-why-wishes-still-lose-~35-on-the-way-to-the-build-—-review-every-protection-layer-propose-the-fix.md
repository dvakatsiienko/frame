---
id: PK-240
title: >-
  data loss: why wishes still lose ~35 % on the way to the build — review every
  protection layer, propose the fix
status: done
assignee: []
created_date: '2026-10-21T13:57:00Z'
updated_date: '2026-10-21T14:22:00Z'
due_date: '2026-10-21'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 7998
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-21, folded: 35 % data loss out of my wish looks pretty not good — considering the number of protection layers we have, we still lose a lot. the missed points were important: plain language and no tech overload; introducing me to unexplored areas smoothly; the pair roles (pair programming mode). i suspected data loss because outputs often don't align with what i wished for; that's why i proposed composer to prep my prompts for easier parsing, and why wishkeeper reviews the boot phase to catch data loss. it still happens, so review it and propose how to fix it. why it matters: my inbox drops open our main lane for the day; i prepare my wishes there as the plan, the input for everything. if i spend an hour prepping a detailed drop and you cut ~35 %, the precision is off by ~35° in the design phase — imagine building a spacecraft that way. fix it right after the PK-173 skill is created, a dedicated turn or a few. evidence: PK-173 (pocket fold ~10 % lost, my want cut ~30 %, grill ~35 %), PK-175 «modularized» unasked, flawlog 16:47 #dima-caught.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 17:02 dima: partly a pm-module issue; the incident folds into PK-103's full review too.

2026-10-21 17:25 fixed via dima-intervenes fix mode (its first run): audit .scratch/data-loss/audit.md — 94 % kept in the pocket, the loss at first use. F1 W-lines at the parse, F2 wish-cover.ts at every use, F3 ticket wish block = the fold (raw stays in the pocket notes), F4 wishkeeper siesta + ccrow hunt check coverage.
<!-- SECTION:NOTES:END -->
