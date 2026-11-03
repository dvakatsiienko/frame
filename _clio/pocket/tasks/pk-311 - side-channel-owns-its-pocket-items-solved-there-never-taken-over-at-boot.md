---
id: PK-311
title: 'side channel owns its pocket items: solved there, never taken over at boot'
status: open
assignee: []
created_date: '2026-11-03T14:13:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 (2026-11-03 16:11, dima, in the side channel): do we have support for side-thread pocket tickets — the tickets i want to solve with the side thread? ❓
today: `pocket-add --side` only marks the birth, and main's boot takes the item over (script/pocket-add.ts:60, FRM-464). side's pick: an owner field `--side` sets, honoured by the boot and pocket-check; new surface → clio:shape-idea and ⚖️ worth it first. ties to the 12:27 fold candidate «a side channel shapes and builds its own asks». first real case: pk-310 (the Finder restart after the halt).
<!-- SECTION:DESCRIPTION:END -->
