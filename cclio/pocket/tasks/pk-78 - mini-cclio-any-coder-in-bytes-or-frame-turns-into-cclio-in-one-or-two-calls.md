---
id: PK-78
title: 'mini-cclio: any coder in bytes or frame turns into cclio in one or two calls'
status: open
assignee: []
created_date: '2026-10-12 11:08'
updated_date: '2026-10-12 12:04'
due_date: '2026-10-14'
labels:
  - m
dependencies: []
priority: next
type: wish
ordinal: 10100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, boot 2026-10-12: sometimes i spawn a coder without you for quickies; at some point i want it to become mini-you — an operator caught up on pm and our flow — without a full boot (no inbox parse and the rest). our rules bar anyone from cclio/ so no one inherits your memory by accident; last night i let a coder in, it had to guess how to init, and i asked it to script that (cclio/script/boot-mini.sh, untracked; frame AGENTS.md already points at it). want: efficient, one or two calls, no guessing, from any place in bytes or frame. cw has a cclio mode (mcp x-cw cclio_mode) — maybe revisit it as a cc-first skill that cw can use too; i need it via cc more often. ask: propose how to set it up.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
proposal 14:49: .scratch/mini-cclio/mini-cclio-proposal.md (one name «cclio mode»: x:cclio-mode skill + x cclio mode verb, mini ≤28 KB default; cw's snapshot found dead since 10-11). dima 14:48: «don't forget mobile-mode: mods are absent on mobile; when I run it, any thread, you included, switches fully to mod-less comms»

dima 14:52: o8 a) mini by default, --full on ask; o9 a) a go verb in x; o10 a) mini writes pocket + linear, each named; o11 snapshot freebie done (cw builds again). and: running x:cclio-mode IS his grant to enter cclio/, the skill never asks. next: a cli coder lane (x cclio mode verb + x:cclio-mode skill + cw tool on its --full output), on his word

15:05: cli lane planner → .scratch/cli-lane-10-12/lane-proposal.md (PK-78 ~280k est + 5 riders ~525k). FRM-383 (sealed, the nearest planned chunk) left out at ~450k est. Read caps: snapshot 138 KB ≈ 47k tokens, past one Read; mini ~35 KB fits, --full pages. FRM-384's planned «x lane gate -- <cmd>» collides with the shipped commit-msg «x lane gate» — rename before sealing 384
<!-- SECTION:NOTES:END -->
