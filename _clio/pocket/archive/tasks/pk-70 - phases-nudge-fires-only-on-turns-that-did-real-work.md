---
id: PK-70
title: phases nudge fires only on turns that did real work
status: done
assignee: []
created_date: '2026-10-11 21:28'
updated_date: '2026-10-12 13:28'
due_date: '2026-10-13'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-10-12 00:28, on cclio's mod idea: «will this reduce the number of redundant tool calls but still keep phases real-time? if yes, park in your pocket, and tomorrow it can join a catch rider».
- why: 641 plan calls in one session (of 1,739 orbit calls); the «phases not set this turn» nudge fires on nearly every turn, Q&A turns included
- want: x-mod-stash nudges for a plan only on a turn that edited a file, spawned or ended a member, or moved a lane; the existing stale mark (a plan untouched 3 turns) keeps the card honest on quiet turns
- open: whether the mod sees those signals (tool names in the turn's calls) — the coder checks the hooks api
- route: a rider on FRM-386 🐠 catch, the next mods coder
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: a rider on FRM-386 🐠 catch, the next mods coder (dima 00:28)

dima 00:29: «2% is a bit too much for all the mods that I use, but mods are incredibly useful — orbit is a game changer, as well as phases; glide is useful too». goal: orbit's share of output tokens under 1 % (2 % measured 10-11). levers: this nudge (641 of 1,739 orbit calls were plan), and cclio's hidden notes to one line (the add inputs held ~242k chars)

rides FRM-386 🐠 catch (o309)

2026-10-12 01:01 correction (ccrow, re-checked): the 00:28 counts double-counted transcript copies. one row per tool_use id and per message.id: 656 orbit calls (plan 235, add 183), cclio output 1.32M tokens; orbit inputs ≈ 4 % of output, all-in ≈ 1.7 % (phases ~0.8 %, glide ~0.1 %). goal: all-in under 1 %. measure with cclio/script/orbit-cost.sql (dedupe by uuid, usage per message.id)

parked: behind the 2026-10-12 drops — dima: «don't rush the memory sweep — solve everything new turn by turn, quality first, then plan the next moves from the new drops»

15:55: queued in mods lane l8, brief 4 (dima's o309)

done: 3158a266 (mods lane l8 brief 4); mods:test exit 0 (wishkeeper 16:27)
<!-- SECTION:NOTES:END -->
