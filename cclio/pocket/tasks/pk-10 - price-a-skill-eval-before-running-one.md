---
id: PK-10
title: 'price a skill eval before running one'
status: waiting
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 11:14'
labels:
  - s
dependencies: []
priority: later
type: test-drive
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
check: dima says the plan changed (a bigger anthropic plan)

pocket 31 · status line was: `open · test-drive` · parked until the budget allows (dima 10-07: «maybe if i get a $200 anthropic plan»)

`claude plugin eval` runs each case as a full session; 10 cases × 3 runs × 2 arms = 60 sessions. first step: one `x:cmt` case («commit this» in a temp repo), one run, `--max-cost-usd 1`, read the printed cost. tiers to decide then: the plugin alone (cheap, does the skill fire on its own phrasing) vs the full fleet context (the truth, the real competition between skills). source: `docs/knowledge/agent-ops.md`.
<!-- SECTION:DESCRIPTION:END -->
