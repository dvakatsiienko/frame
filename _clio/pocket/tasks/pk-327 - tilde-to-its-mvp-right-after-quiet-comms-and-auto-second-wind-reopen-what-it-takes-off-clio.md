---
id: PK-327
title: >-
  tilde to its mvp right after quiet comms and auto second wind; reopen what it
  takes off clio
status: open
assignee: []
created_date: '2026-11-05T22:08:00Z'
updated_date: '2026-11-06T16:23:00Z'
labels:
  - s
  - side
dependencies: []
priority: next
type: task
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's word 11-06 00:07, in the side channel, for his plan with main clio. side's read of docs/research/tilde-plan.md: rights keep the merge, x lane landed and every linear write with clio, while he names signing and merging as the load; its gate (5 codie chunks, his 11-04 «no rush») predates this word. FRM-368 owns the outcome: fold there at the sort.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1 (2026-11-06 00:07, dima): from my point of view, one main lane for clio doesn't work: she is overloaded even when i offload a lot of chores to the side channel. even with quiet comms she still has a pretty large amount of activity taking care of side lanes: the signing, the merging and everything else.
W2 (2026-11-06 00:07, dima): with that part offloaded to tilde, clio will have much more space in her main thread. even with two channels there is not enough capacity to solve all chores quickly: today's pile took me about 3 to 4 hours, split between you two.
W3 (2026-11-06 00:07, dima): let's have tilde prioritized as soon as possible. i plan, with main clio, to prioritize quiet comms proving rounds tomorrow, and auto second wind tomorrow too. after that, our priority will be to have tilde to the mvp.
W4 (2026-11-06 00:07, dima): in mainline only one pattern works well: to solve one thing at a time. once anything external gets into a thread, like a merge request during a grill, it blurs what we do. the side channel works much better because it is parked beside clio, doesn't act as a coordinator, and nobody interferes.
W5 (2026-11-06 00:07, dima): even with tilde, side channel capabilities could be improved. i don't really like that it's cut from crew, and i don't really like that it's parked inside a worktree, though that is probably unavoidable or it fights main clio on updates. how to make it more capable? ❓
W6 (2026-11-06 00:07, dima): i want the side channel to operate with tickets; clashes will sometimes happen, it's the nature of it, and it's fine: we try not to work on the same tickets, as today with FRM-495.

W7 (2026-11-06 03:06, dima): let's prefer side channel execution; it is a spam-free, performant channel, while side lane distractions hurt main lane performance, and even a basic merge interrupts the main lane. i'll hop between you two: you take care of coordination for lanes, and i solve the rest of the operational stuff with the side channel.
W8 (2026-11-06 03:06, dima): eventually i want to test drive tilde. with tilde taking care of coordination, your main lane is unloaded even more, and we have a spare side channel to solve more stuff.
W9 (2026-11-06 03:06, dima): before that, we need to measure quiet comms, because quiet comms affects everyone, you and tilde as well. everything we optimize right now transfers to tilde too, so let's focus on that first.
<!-- SECTION:NOTES:END -->
