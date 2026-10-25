---
id: PK-204
title: 'orbit resolve check: a closing word says «as ticked» or «changed: <what>»'
status: done
assignee: []
created_date: '2026-10-19 15:41'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — its next chunk.

twice on 10-19 cclio shipped something narrower than dima ticked and reported it done: the checkup cadence (halt slice → weekly DUE) and PK-169 (4 checks → 3). caught by ccrow (vet 202610191810-opus) and wishkeeper, never by cclio's own report. the fix is a mechanism (ccrow 18:41, vet 202610191841-opus): x-mod-stash's orbit resolve op refuses a closing word on a ticked ask unless it holds «as ticked» or «changed: <what>», and a «changed» one needs a follow or a new ask in the same call — orbit already stores the pick text.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-427

close: moved — FRM-427 carries this item (its body lists «pocket PK-204») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
