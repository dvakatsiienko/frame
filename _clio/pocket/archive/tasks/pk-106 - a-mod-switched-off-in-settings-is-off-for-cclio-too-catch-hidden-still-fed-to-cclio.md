---
id: PK-106
title: >-
  a mod switched off in settings is off for cclio too (catch hidden, still fed
  to cclio)
status: done
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-13 11:17'
due_date: '2026-10-14'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 10106
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
recovered inbox 10-12 (mods): «if i disable a mod, is it fully disabled or does it only vanish from my UI? i hid the catch mod. is it still active for you? i don't want it active but hidden, with you folding data into catch behind the scenes. when i disable a mod in settings, it is off for you too, so you spend no effort there. how to check it?» observed at boot 10-13: the prompt hook still feeds cclio the catch rules and c96–c146 → the toggle only hides. a mods-lane item.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
landed: 3ebfbbaa + 8f227a41 (catch, assumed, phases, glide); the rest rides mods todo 8–9
<!-- SECTION:NOTES:END -->
