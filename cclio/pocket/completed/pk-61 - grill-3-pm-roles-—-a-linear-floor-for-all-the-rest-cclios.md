---
id: PK-61
title: 'grill 3: pm roles — a linear floor for all, the rest cclio''s'
status: done
assignee: []
created_date: '2026-10-11 16:23'
updated_date: '2026-10-11 17:19'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: now
type: grill
ordinal: 2200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
grill 3 of 3 (dima o171): pm roles — who does what in linear. dima, o165 (folded): «coders never write tickets, from what i saw; they only read tickets and sometimes write comments, and they do not do well creating or editing tickets. you are the main pm and do 99 % of everything in linear and the pocket, while the pm skill has heavy descriptions of the linear flow. most of the linear-related stuff should be known only by you; all fleet members should have a floor, only a base set of rules to navigate linear and not make dumb mistakes. let's not rush with this skill — carefully rethink how to rebalance x:pm and your resident memory about pm.» on to-tickets (19:12): «coders write tickets through matt's to-tickets; these tickets are local to the coder, temporary, and can die after the work is done (kept only for history and data analysis).»
data (sifter, 19:06): 91 coder sessions 09-28 → 10-11, 705 linear commands: 656 reads, 22 sets, 13 comments, 13 body edits in 3 sessions (FRM-346–350, the cli chunks, shape-lane 2.5), 0 real creates.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
grill 3 round 1, dima 20:02 on Q1 (folded): «i only used cw to create a ticket a few times, maybe 2 months ago, and i do not use cw for linear at all. this functionality can maybe be killed fully, along with the pm reference in the cw mcp.» → x:pm is cclio's alone; cw's pm_guide tool (home/.claude/mcp-x-cw/src/pm.ts) dies; round 2 decides x:pm's home (cclio plugin vs folded into craft-pm).

round 1, dima 20:06: Q2 the floor (rules-lazy/linear-flow.md) is a member's only pm doc — his worry (folded): «we just built the linear cli to improve fleet efficiency and solve access problems, and now we cut access to the pm skill — i agree, it is fat. but how does the fleet learn the x linear doors and use only the optimized verbs they need? coders still read linear a lot and write comments.» → round 2; Q3 state and labels are cclio's only, a member's done ping is the trigger; Q4 to-tickets slices live in .scratch/<feature>/issues/, never linear, whoever runs to-tickets (coder or cclio; shape-lane or crew-coder carries it, «let's try»); Q5 members write comments only, through x (coders and verifiers), linear-as retires. found: x linear's --as defaults to cclio for ANY agent, so a member's bare comment posts as cclio.

grill 3 landed 20:20: x:pm moved to cclio:pm (cclio/plugin-cclio/skills/pm), groomed 26.8 KB → 13.3 KB with its recipes; craft-pm 16.2 KB → 6.3 KB resident; the floor rules-lazy/linear-flow.md rewritten (two doors, members never write but the done comment); crew-coder + crew-verifier doors; shape-lane local slices; the guard and the x default are PK items; cw pm_guide + linear-as removal asked.
<!-- SECTION:NOTES:END -->
