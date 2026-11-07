---
id: PK-332
title: 'side channel unloads the main thread: make the habit hold until tilde decides'
status: open
assignee: []
created_date: '2026-11-06T01:25:00Z'
updated_date: '2026-11-07T13:41:00Z'
labels:
  - s
  - wing-2
dependencies: []
priority: next
type: task
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PK-332:W1 (2026-11-06 03:25, dima): remember to use the side channel as a way to unload your main thread, at least until we figure out if tilde will unload your own main lane well enough, so a side channel will be less needed. fold this into another side lane and a pocket item, so i will figure out how to solve it with the side channel as well.

the memory line landed, craft-fleet-flow § lane init. the open part, with him in the side channel: what makes it hold in practice, since a line alone decays: a boot step, a hook that offers the channel on a chore, a measure of how much left the main thread.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-332:W2 (2026-11-06 14:23, dima): i'd like your habits updated so we make this split habit-based. whenever i start clio from scratch, clio should know that lane activities are preferred to be run by main clio, and all side chores, grills and other stuff are delegated to the side channel, the model we did today. consult main clio on how to make it work well.
PK-332:W3 (2026-11-06 14:28, dima): so main clio's lane is treated as a coordination lane, and your side channel as the main lane, where we solve all the chores and stuff like today's scope.
PK-332:W4 (2026-11-06 14:23, dima): how do you store your durable plans so they survive between second winds? i vote for the pocket, because i can see it; maintain it as an easy-to-read checkbox list.
landed 14:32: clio:boot, clio:side-channel, craft-fleet-flow; PK-336 the first day plan. left: what makes it hold in practice.

W (2026-11-06 15:43, his tick o31): fix: side prompts join the prompt log. pocket-check reds every side fold today, since prompt-groom and the fold check read the day's prompt log, which side prompts never reach; a no-wish line clears --day, not pocket-check. 7 reds on closed PK-323 until then.
<!-- SECTION:NOTES:END -->
