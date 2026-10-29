---
id: PK-247
title: >-
  memory budget: warn right after an edit pushes a budgeted file past its
  memory-budgets.tsv row
status: done
assignee: []
created_date: '2026-10-21T17:50:00Z'
updated_date: '2026-10-23T09:42:00Z'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
retro 2026-10-21 #2 (o126): two over-budget skill files cost 2 refused commits (~85 s each) + a groom. a PostToolUse hook on Edit/Write reads recipes/nurture-memory/scripts/memory-budgets.tsv. author-blueprint SKILL.md and readable.md sit within 10 B of their rows.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: worked at the 10-22 low tide beside PK-244 (dima o126: fixes 1–3 tomorrow)

2026-10-22 halt: due moved to 10-23 on dima's word («fold everything that wants me for tomorrow»).

ticket: FRM-416 — moved to linear 2026-10-23 on dima's o1 tick; the pocket item dies here.

close: FRM-416 done in place 2026-10-23 (freebie, dima o7).
<!-- SECTION:NOTES:END -->
