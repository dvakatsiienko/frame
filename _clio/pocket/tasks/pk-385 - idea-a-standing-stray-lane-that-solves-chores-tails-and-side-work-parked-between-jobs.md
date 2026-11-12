---
id: PK-385
title: >-
  idea: a standing stray lane that solves chores, tails and side work, parked
  between jobs
status: open
assignee: []
created_date: '2026-11-12T11:37:00Z'
updated_date: '2026-11-12T19:00:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 55000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-385:W1 (2026-11-12 inbox, dima): idea: a standing stray lane. it never dies, stays parked, and waits for inbound traffic; it starts on first demand, not at boot.

PK-385:W2 (2026-11-12 inbox, dima): an optional standing verifier, on demand.

PK-385:W3 (2026-11-12 inbox, dima): it is sharpened to expect complete specs and to use to-tickets over them; it requests a spec if one is not provided.

PK-385:W4 (2026-11-12 inbox, dima): it solves chores, tails, just work; it can help any lane with something: consultations, the chore side or complementary work, especially where areas are close or overlap.

PK-385:W5 (2026-11-12 inbox, dima): it can solve bigger side chores beside the main scopes we usually act on, for example the migration from pnpm to bun.

PK-385:W6 (2026-11-12 inbox, dima): it takes a second wind before each big spec. test drive it.

raw drop (2026-11-12 inbox, dima): standing stray lane. it:

raw drop (2026-11-12 inbox, dima): - never dies, stays parked, waits for an inbound traffic

raw drop (2026-11-12 inbox, dima): - starts on first demand, not st boot

raw drop (2026-11-12 inbox, dima): - optional standing verifier on demand

raw drop (2026-11-12 inbox, dima): - it is sharpened to expect complete specs and use to-tickets over them. it requests a spec if not provided.

raw drop (2026-11-12 inbox, dima): + solves chores, tails, just work

raw drop (2026-11-12 inbox, dima): + can help any lane with something. consultations. chore side or complementary work. especially if areas are close or near overlap.

raw drop (2026-11-12 inbox, dima): + can solve bigger side chores aside main scopes we usually act on. for example - migration from pnpm to bun.

raw drop (2026-11-12 inbox, dima): + takes second wind before each big spec.

raw drop (2026-11-12 inbox, dima): + test drive it

PK-385:W7 (2026-11-12 20:59, dima, o52 steer): figure out how the threads won't fight over the lane: if main clio asked it to do something and you want to send it something too — the queue
PK-385:W8 (2026-11-12 20:59, dima, o53 steer): bun migration was just an example; bigger work is probably better for a dedicated quick or side lane
PK-385:W9 (2026-11-12 20:59, dima, o53 steer): a verifier? maybe. wishkeeper is likely ok, let's keep the wishkeeper check
PK-385:W10 (2026-11-12 20:59, dima): model? i think opus 5.5 medium will work 100 %, but maybe it is overkill? if we agree to send it only well-scoped work, maybe try sonnet 5.5 medium as the standing chore lane ❓
PK-385:W11 (2026-11-12 20:59, dima): the cli lane was fully finished and has no chunk pending; that's why the cli codie got reassigned to the stray lane to help you
PK-385:W12 (2026-11-12 20:59, dima): q6: no, it isn't parked across halts. how do you imagine it parked across halts? its cache goes cold
PK-385:W13 (2026-11-12 20:59, dima): instead it is never summoned at boot, since why keep it parked for nothing; it is summoned on the first pending chore, solves it, then stays parked and keeps doing the chores that appear during the day, and is stopped with everyone else at the halt
<!-- SECTION:NOTES:END -->
