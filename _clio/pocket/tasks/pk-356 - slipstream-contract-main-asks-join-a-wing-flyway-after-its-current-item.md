---
id: PK-356
title: 'slipstream contract: main asks join a wing flyway after its current item'
status: open
assignee: []
created_date: '2026-11-09T12:37:00Z'
updated_date: '2026-11-09T12:37:00Z'
labels:
  - s
  - clio-wing-2
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-356:W1 (2026-11-09 inbox, dima): wing 1: solves perf tails, proposes best next actions, then parks

PK-356:W2 (2026-11-09 inbox, dima): wing 2: i steer piles of chores, the solve queue; main clio can delegate operational work to it, but only via slipstream mode

PK-356:W3 (2026-11-09 inbox, dima): why slipstream: main clio sometimes starts solving its asks mid-turn while a wing is solving something else; not good. instead, a main clio ask joins wing 2's flyway solve queue, right after the current item

PK-356:W4 (2026-11-09 inbox, dima): contract: main clio and all wings should know it; for wing 2 it is a habit to keep

PK-356:W5 (2026-11-09 inbox, dima): main clio asks join the wings in slipstream mode, unless urgent or i say otherwise

PK-356:W6 (2026-11-09 inbox, dima): wing 3: compile its flyway from this inbox

PK-356:W7 (2026-11-09 inbox, dima): clio main, wing 2 and wing 3 go through their flyways via «low-tide»

PK-356:W8 (2026-11-09 inbox, dima): i placed markers across the inbox for who does what; fold each action item into its flyway

PK-356:W9 (2026-11-09 inbox, dima): wing 2 starts low-tide triage to seal all flyways, then low-tide over its flyways; main clio also low-tides over its flyway plan; wing 1 has its plan and just solves

raw drop (11-09 inbox, dima): ## 🛹 general steering

raw drop (11-09 inbox, dima): wing 1: solves perf issues tails and proposes best next actions. what it could do. and parks.

raw drop (11-09 inbox, dima): wing 2: i steer piles of chores solve queue. main wing can delegate operational work. but, important: only via slipstream mode. it is a contract, both main clio and all wings should know it (its a habit todo for wing 2). any main clio wishes joins wings in slipstream mode. unless urgent or i tell.

raw drop (11-09 inbox, dima): why? because sometimes model starts to solve clio asks immediately while we was solving something else mid turn with a wing. not good. instead - main clio asks joins wing flyway solve queue, right after current solve item.

raw drop (11-09 inbox, dima): wing 3: compile its flyway from this inbox

raw drop (11-09 inbox, dima): clio main, wing 2 and wing 3 goes through their flyways via «low-tide»

raw drop (11-09 inbox, dima): i placed markers across inbox who does what — fold each action item into correpsonding flyway.

raw drop (11-09 inbox, dima): then - wing 2 starts with lowtide triage — to seal all flyways. then wing 2 starts low-tide over its flyways. main clio also does low-tide over flyway plan. wing 1 have its plan it just solves.
<!-- SECTION:NOTES:END -->
