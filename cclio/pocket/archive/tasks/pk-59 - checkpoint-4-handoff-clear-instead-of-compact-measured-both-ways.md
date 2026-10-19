---
id: PK-59
title: 'checkpoint 4: handoff + /clear instead of /compact, measured both ways'
status: done
assignee: []
created_date: '2026-10-11 15:37'
updated_date: '2026-10-11 15:41'
labels: []
dependencies: []
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima o164 (18:36), his take: compact reads the whole 600-700k and the reinit then carries the compact summary plus the handoff, both. trial at the next checkpoint: write the CST (wishkeeper 3.5 check), /clear, ingest; record the fresh context size (/context first turn) and every fact lost, vs checkpoint 3's compact (this thread). verdict → cclio:checkpoint § 4 two-line fence.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dropped on dima's word 18:40: «let's keep the usual habit with compaction … that context is not wasted and somewhat useful, so let's keep it. data loss is worse.»
<!-- SECTION:NOTES:END -->
