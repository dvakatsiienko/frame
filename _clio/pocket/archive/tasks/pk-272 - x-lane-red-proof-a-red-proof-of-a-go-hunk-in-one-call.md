---
id: PK-272
title: 'x lane red-proof: a red proof of a go hunk in one call'
status: done
assignee: []
created_date: '2026-10-23T20:33:00Z'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** a cli lane chunk
asked by 3 retros (FRM-423 coder, FRM-423 verifier twice), with x lane mutate (FRM-404/405 verifiers) folded in: builds a scratch copy of x/go with main's source for the pr's non-test hunks, runs the named tests, prints red/green per test
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-435
close: moved to FRM-435, its wish block carries them (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
