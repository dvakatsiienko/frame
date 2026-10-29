---
id: PK-274
title: >-
  code review has no card of its own: matt's code-review sub-agents fall to
  researcher
status: done
assignee: []
created_date: '2026-10-25T10:36:00Z'
updated_date: '2026-10-25T14:13:00Z'
due_date: '2026-11-01'
labels:
  - s
dependencies: []
priority: later
type: question
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parked: dima 2026-10-25 (o7) — keep researcher for now, revisit later; not now, a lot else to solve
W1 (2026-10-25, dima): using the researcher subagent for code reviews is too blurry: he is a researcher first and a file lookup hunter second, his instructions say nothing about code review, and his stats get harder to measure
W2 (2026-10-25, dima): it is a flaw in our system, but with nothing to replace the researcher, keep it like this for now and revisit at some point
evidence: general-purpose is denied in home/.claude/settings.json; matt's code-review names no card; the cli-2 coder (8e8015da) ran 12 of 14 review spawns as researcher
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-455
close: W1 moved, W2 moved — to FRM-455 (dima o75: actual, to be resolved)
<!-- SECTION:NOTES:END -->
