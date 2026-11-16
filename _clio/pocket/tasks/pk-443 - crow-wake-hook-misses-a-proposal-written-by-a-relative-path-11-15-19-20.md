---
id: PK-443
title: crow-wake hook misses a proposal written by a relative path (11-15 19:20)
status: done
assignee: []
created_date: '2026-11-16T12:23:00Z'
updated_date: '2026-11-16T23:02:00Z'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wisp, mine, free; lived only in the 11-15 CST (lines 42, 81, 86)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
01:02 close: fixed by the stray, 710bff96 on origin/main (crew-adviser proposalOf resolves a relative path against the call's cwd; its test red on base, green on the fix); no W-lines (my wisp)
<!-- SECTION:NOTES:END -->
