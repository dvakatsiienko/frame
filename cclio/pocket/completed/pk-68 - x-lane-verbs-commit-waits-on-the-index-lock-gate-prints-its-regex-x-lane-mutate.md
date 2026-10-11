---
id: PK-68
title: >-
  x lane verbs: commit waits on the index lock, gate prints its regex, x lane
  mutate
status: done
assignee: []
created_date: '2026-10-11 21:17'
updated_date: '2026-10-11 21:36'
due_date: '2026-10-14'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
from the 10-11 halt flush (gather clusters 4, 5, 11):
- `x lane commit` waits on `.git/index.lock` with a deadline and gates only its pathspec (coders blocked by cclio's staged batch, 3 sightings)
- `x lane gate` prints its exact regex on refusal and names a leading `- ` (two lanes paid the same retry)
- `x lane mutate`: anchor-replace + test + restore, a table out (every wrong-reason test on 10-11 was found only by mutating the claimed line; moved here from PK-65)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: waits for the next cli coder, on dima's word

folded 2026-10-12 (o308): the lock wait and the gate regex ride FRM-384, x lane mutate is FRM-383's x verify red --pairs
<!-- SECTION:NOTES:END -->
