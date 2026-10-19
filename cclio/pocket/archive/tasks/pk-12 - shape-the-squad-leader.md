---
id: PK-12
title: 'shape the squad leader'
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 16:49'
labels:
  - l
dependencies: []
priority: next
type: grill
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 33 · status line was: `open · grilling` · pulled ahead of 10 (dima 10-08: «plan your coordination module split earlier … prioritize the planning»); the 10-07 estimate: `craft-spawning` keeps a ~5k core, the brief lessons move to `x:crew-lead`, ~19k tokens off every cclio turn

dima 10-08 13:22: the crew-coordinator as part of a squad (an independent `--bg` session outside cclio) is to be a/b test-driven.

dima 10-07: «instead of spawning a coder you spawn a squad leader (e.g., a coordinator). It is a mini coordinator … it essentially manages a coder and a verifier with the given task by you. It handles communication between the coder and verifier and only reports to you with positive results, issues and disputes, or design questions that I would be interested to answer. This way your thread will be filtered out of the noise». the sweep (ticket 05) cuts `craft-spawning` by trigger first; the squad leader is shaped with `x:shape-idea` from what that cut leaves. its skill name: `x:crew-lead` (dima 10-07 ✓, beside `crew-coder` / `crew-verifier`).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima 10-09 17:29: the squad lead waits for capacity → FRM-368 (wish, grill folded). now: extract x:crew-lead — craft-spawning leaves resident memory, loads on demand before any spawn/brief/watch/stop; written universal (cclio now, a standalone lead later). no a/b now

done 10-09: x:crew-lead extracted (craft-spawning off resident memory, ~15k tokens/turn measured); the standalone lead → FRM-368
<!-- SECTION:NOTES:END -->
