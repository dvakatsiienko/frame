---
id: PK-70
title: phases nudge fires only on turns that did real work
status: open
assignee: []
created_date: '2026-10-11 21:28'
updated_date: '2026-10-11 21:36'
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
<!-- SECTION:NOTES:END -->
