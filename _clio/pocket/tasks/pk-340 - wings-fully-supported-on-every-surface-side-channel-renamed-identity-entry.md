---
id: PK-340
title: 'wings: fully supported on every surface, side channel renamed, identity entry'
status: done
assignee: []
created_date: '2026-11-06T16:31:00Z'
updated_date: '2026-11-06T20:00:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 40000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-340:W1 (2026-11-06 18:10, dima): yes pocket items needs a tweak to tell which side channel they relate to (like current pk-336).

PK-340:W2 (2026-11-06 18:10, dima): also - let's think of other name for «side channel».

PK-340:W3 (2026-11-06 18:10, dima): Side channel is fine, and it is clear, but it's a little long to print, and it clashes a little with side lanes.

PK-340:W4 (2026-11-06 18:10, dima): For example i could quickly type «your side» but that could mean both side lane or side channel, i want quick alias so i could name it like «your side 1» your side 2 etc.

PK-340:W5 (2026-11-06 18:10, dima): top7

PK-340:W6 (2026-11-06 18:16, dima): approve. (re: 🦉🪽 clio: wing 1)

PK-340:W7 (2026-11-06 18:16, dima): and let's have your wings 🪽 like this. (re: 🦉🪽 clio: wing 2)

PK-340:W8 (2026-11-06 18:18, dima): no, let's solve wing with you side channel is busy.

PK-340:W9 (2026-11-06 18:18, dima): thats why i ask for more wings.

PK-340:W10 (2026-11-06 18:18, dima): what needs to be done to have wings fully supported on all surfaces? ❓

PK-340:W11 (2026-11-06 18:19, dima): i propose you to SW and build wings after SW as a prio i need at least another wing, lots of stuff to do and everyone busy.

PK-340:W12 (2026-11-06 18:28, dima): after wings are ready — rename existing side channel into wing 1 and update her pocket plan to mark it as wing 1 owner.

PK-340:W13 (2026-11-06 18:28, dima): then start wing 2 and tell that i want to solve rex pocket item (from wing 1 plan) with wing 2.

PK-340:W14 (2026-11-06 18:28, dima): and tell it to stay parked.

PK-340:W15 (2026-11-06 18:30, dima): dont forget to sync side wtree so habits are synced (if needed) and tell side channel that it is wing now (not side) — update «side channel» to «wing» on all surfaces.

PK-340:W16 (2026-11-06 18:30, dima): plus — a new entry in identities + maybe a vibe word.

PK-340:W17 (2026-11-06 18:30, dima): so if a wing messages to anyone - anyone should know who wing is.

PK-340:W18 (2026-11-06 18:30, dima): so no one is confused.
board steer o44 (2026-11-06 18:42, dima): groom fleet identities with /x:author-memory, see if you can optimize it without budget raise (with no data loss, drop fluff). if cant without data loss - raise budget

close: 2026-11-06 — wings live: `fleet-identity` holds the entry and the message rule (W16–W18), `fleet-vibe` the word, `wing-<N>` the label (W1, cbeacbd2), `clio:wing` opens them, wings 1–3 run (W8–W14). rg 'side channel' across rules, skills, memory finds only 3 «was side channel» lines (W15). W10 answered by the build.
<!-- SECTION:NOTES:END -->
