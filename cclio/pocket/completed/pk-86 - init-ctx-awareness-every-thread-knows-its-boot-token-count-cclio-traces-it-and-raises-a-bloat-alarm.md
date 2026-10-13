---
id: PK-86
title: >-
  init ctx awareness: every thread knows its boot token count; cclio traces it
  and raises a bloat alarm
status: done
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-13 15:29'
due_date: '2026-10-17'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, inbox 2026-10-12, folded. any cc thread knows its init ctx number (spawned, not yet prompted; just the number, e.g. 65k, no breakdown). why: memory and skills only grow, never shrink — folding is a time bomb (the sweep is defusing it now), and you can't fully patch yourself safely; deleting memories wants weighted decisions. for cclio, more: she manages her own and the fleet's init ctx numbers, keeps the current session's init size and actively works the memory topic; trace the number historically, spot growth, raise an alarm to me with proposals (propositional reports, not informative); growth can be good and intentional. test drive it on cclio only first. the want behind it: a good mechanism that keeps memories and skills tidy and pretty. questions: how to make this truly work? maybe a research fan-out to find a good shape and home for the habit.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: queued under the ≤5 open cap, 2026-10-12 — worked in ordinal order after PK-75–79

18:32 folded into FRM-72, the pm review (dima 18:28: «connect this to your pm revamp ticket»)
<!-- SECTION:NOTES:END -->
