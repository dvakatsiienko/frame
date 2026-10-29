---
id: PK-10
title: price a skill eval before running one
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: test-drive
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** dima says the plan changed (a bigger anthropic plan)

pocket 31 · status line was: `open · test-drive` · parked until the budget allows (dima 10-07: «maybe if i get a $200 anthropic plan»)

`claude plugin eval` runs each case as a full session; 10 cases × 3 runs × 2 arms = 60 sessions. first step: one `x:cmt` case («commit this» in a temp repo), one run, `--max-cost-usd 1`, read the printed cost. tiers to decide then: the plugin alone (cheap, does the skill fire on its own phrasing) vs the full fleet context (the truth, the real competition between skills). source: `docs/knowledge/fleet-ops.md`.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18 boot: dima steers today to parse + answers + the viz-tool shape; the pocket gets solved after the weekly reset (10-19 07:00); evals only on his word
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved to FRM-184 — folded under «from the pocket» (0 of 0 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
