---
id: PK-151
title: 'x lane commit runs quote-diff on memory, skill and rules files'
status: done
assignee: []
created_date: '2026-10-15 17:53'
updated_date: '2026-10-22T16:51:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane — its chunk (owner named in the retro).
retro 2026-10-15 (dima's yes): quote-diff flagged dima's lines 6 times tonight and cclio waved 2 through as «not his»; wishkeeper caught them. the gate: x lane commit runs cclio/script/quote-diff.py HEAD over the staged skill, memory and rules files and goes red unless the message carries a 'quotes: shown' line. owner: the cli lane.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-405 (cli lane 1, sealed 2026-10-20)

2026-10-22 19:55: closed into FRM-405 at the cli lane 1 spawn (its scope is sealed in that ticket's exit lines; chunk 1 FRM-401 running)
<!-- SECTION:NOTES:END -->
