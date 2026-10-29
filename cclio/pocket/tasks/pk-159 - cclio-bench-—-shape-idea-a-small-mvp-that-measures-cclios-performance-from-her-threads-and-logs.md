---
id: PK-159
title: >-
  cclio bench — shape-idea: a small mvp that measures cclio's performance from
  her threads and logs
status: open
assignee: []
created_date: 2026-10-16 10:24
updated_date: '2026-10-29T11:28:00Z'
due_date: '2026-10-30'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the memory sweep (FRM-267) to close — it runs right after.
inbox 10-16, wish: build a solid cclio bench, not too complex — a script, recipe or other shape that searches her threads, traces and logs for performance data; any shape that proves to work and look good. the goal: optimise her workload. which data to hunt? reviewing a flow model like hers, what would count as not performant? a small mvp, little effort; made solid only if it works at all, and useful. why: the operator-comms recipe found his comms patterns and flaws, the memory fixes after it felt like a x7 upgrade — the same for cclio: what affects her performance now, what to hunt to bench her properly, her own baseline. she reads her threads and logs herself, hunts inefficiencies in her flows, and fixes them. measures are synthesised through grilling and her own grooming pass after. shape it with cclio:shape-idea. order: right after the memory sweep.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-16: OpenTelemetry is a bench input — proposal in cclio/.scratch/otel/proposal.md (cost, active time, cache hits, tool decisions per role).
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

kept: 2026-10-25 — cclio's own shapeless idea (Q5); no wait, worked when a window opens

kept: 2026-10-28 — a later shape-idea wish that belongs in linear; it carries dima's words, so the move is asked at today's halt

kept: 2026-10-29 — dima o2: «keep it parked, i'll take care of it with fork (try)»
<!-- SECTION:NOTES:END -->
