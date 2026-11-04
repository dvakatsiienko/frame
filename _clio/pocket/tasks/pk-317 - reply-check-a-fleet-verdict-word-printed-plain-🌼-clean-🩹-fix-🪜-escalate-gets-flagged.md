---
id: PK-317
title: >-
  reply-check: a fleet verdict word printed plain (🌼 clean, 🩹 fix, 🪜
  escalate) gets flagged
status: done
assignee: []
created_date: '2026-11-03T19:22:00Z'
updated_date: '2026-11-04T14:46:00Z'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
flawlog 2026-11-03 15:52 #dima-caught: the verdict words printed unbolded though rules/fleet-output-format.md § emoji bolds every fleet word; a reply-check rule over the fleet-vibe word list is the guard. no answer from dima on the flush at 21:22: clio's default, asked at the 11-04 boot.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: 2026-11-04 — dropped, no guard: measured over today's 222 replies, 0 real misses among the fleet's badge names (3 hits, all inside a bold or a link). one catch on 11-03 doesn't pay for a rule; a second sighting brings it back with teeth.

correction 2026-11-04 16:02: the drop above is withdrawn: my measure read badge names, never the verdict words (wishkeeper). rerun with fleet-vibe's verdict line before any call.

rerun 2026-11-04 16:20: fleet-vibe's verdict line, clio's replies since it landed (11-03 13:44), 714 deduped replies: 10 badged plain (🌼 clean, unbolded), 10 bare plain in verdict context (sixth sense + clean), 9 bold. every sighting is clean; 🩹 fix and 🪜 escalate never printed as verdicts. the earlier 0 was a measure of badge names. script: scratchpad pk317b; his call in orbit.

ticket: FRM-495
close: 2026-11-04 — his o65 tick: the warn joins FRM-495's reply-check rules.

correction: the rerun note above reads 16:20; it was written at 16:06.
<!-- SECTION:NOTES:END -->
