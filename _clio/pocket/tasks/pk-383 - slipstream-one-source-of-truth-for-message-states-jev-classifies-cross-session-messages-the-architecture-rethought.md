---
id: PK-383
title: >-
  slipstream: one source of truth for message states, jev classifies
  cross-session messages, the architecture rethought
status: open
assignee: []
created_date: '2026-11-12T11:37:00Z'
updated_date: '2026-11-12T11:41:00Z'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 53000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-383:W1 (2026-11-12 inbox, dima): another slipstream idea: a single source of truth for what the slipstream states («ask», «done» etc.) are. sharpen the slipstream spec so it is properly groomed in code too, and resilient; each message type properly described, so it can be classified.

PK-383:W2 (2026-11-12 inbox, dima): btw! can we use jev for classification? jev can classify fleet slipstream messages (cross-session only). ❓

PK-383:W3 (2026-11-12 inbox, dima): when we get to slipstream, let's rethink how we have it architecturally (mods side?). i want the slipstream message system to be solid and to function very well. ❓
<!-- SECTION:NOTES:END -->
