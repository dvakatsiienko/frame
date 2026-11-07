---
id: PK-351
title: 'clio: winged v2'
status: open
assignee: []
created_date: '2026-11-07T14:57:00Z'
updated_date: '2026-11-07T16:01:00Z'
labels:
  - m
  - wing-2
dependencies: []
priority: next
type: task
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
the story of revamping how winged clio works: who does what and when, the boundaries, worktree sync, pocket and ticket assignment to wings. owner: wing 2. solved after the chores, on his order.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-351:W1 (2026-11-07 16:55, dima): yesterday we invented the wings, and they change a lot how the fleet works, especially how i talk to main clio and all the wings.
PK-351:W2 (2026-11-07 16:55, dima): the wings' performance, functionality and habits need to be steered, shaped and groomed first. let's approach this topic from a higher level first.
PK-351:W3 (2026-11-07 16:55, dima): it's a bigger topic, so let's postpone it until later: more chores keep piling up, and i want to solve them.
PK-351:W4 (2026-11-07 16:55, dima): afterwards we sharpen how wings operate and how they relate to main clio, and decide who does what and when.
PK-351:W5 (2026-11-07 16:55, dima): we also sharpen how wings take care of the pocket items, and the policy of assigning pocket items to wings, maybe linear tickets too.
PK-351:W6 (2026-11-07 16:55, dima): now we have multiple surfaces for who does what where: main clio and an infinite amount of wings. i currently prefer at least two wings; it should be enough.
PK-351:W7 (2026-11-07 16:55, dima): why i have this: main clio is always overloaded and her main thread does not keep up. so i invented a model of multiple wings, essentially the same clio, that balance the load across the main lane and each wing.
PK-351:W8 (2026-11-07 16:55, dima): that's why we solve chores with you now: main clio is busy coordinating. i said clio is responsible for coordinating most of the lanes, and chores are currently solved with you, wing 2.
PK-351:W9 (2026-11-07 16:55, dima): we solve chores because a lot of tails piled up.
PK-351:W10 (2026-11-07 16:55, dima): wing 1 currently solves a cpu-related issue and maintains its own lane. it is an exception.
PK-351:W11 (2026-11-07 16:55, dima): usually a wing is not preferred to operate its lanes, but it is possible in exceptional cases or if it just fits: the cpu roasting problem is quite narrow and specific, so i made wing 1 its owner.
PK-351:W12 (2026-11-07 16:55, dima): main clio operates the mods lane and the ci lane, while also solving some other operational stuff when she is not very busy.
PK-351:W13 (2026-11-07 16:55, dima): this is the idea: i change how the fleet operates until we have tilde.
PK-351:W14 (2026-11-07 16:55, dima): tilde is a plan, another point of unloading main clio: tilde will do coordination, and this way unload her even more.
PK-351:W15 (2026-11-07 16:55, dima): until we have that, let's groom the current picture while we make the transition. we have to decide who does what and define clear boundaries so nothing drifts.
PK-351:W16 (2026-11-07 16:55, dima): the most important parts are the worktrees: each wing works in a worktree, and drift happens quite a lot because each wing can change its tree while main clio changes main. so syncs between main and the wings' trees have to happen frequently both ways: merging a worktree into main, and main into a worktree.
PK-351:W17 (2026-11-07 16:55, dima): fold all of this into a pocket item «clio: winged v2»: a story about revamping the new approach with winged clio, collocating all other pocket items and tickets of this area into one story. you own it. we solve it a little later.

gathered here, each keeps its own home until this story is solved (his word on collocating; a ticket stays in linear):
- PK-332 what makes the wing habit hold (moved in, below)
- closing a wing has no verb, any close: line closes a day plan: PK-336:W23 (copied below)
- PK-343 wing hand-back reds the groom check, main-lane label
- PK-342 wire what we build: chores go to the wings, main coordinates, main-lane label
- PK-345 parked member: a wing missed a codie sitting idle
- FRM-516 crow advises main clio and all its wings
- FRM-368 tilde, a lane coordinator
- FRM-509 a lane end leaves nothing behind: worktrees clean themselves
- FRM-501 quiet by default, a message to clio slipstreams

from PK-336: PK-336:W23 (2026-11-07 04:39, dima): closing a wing has no verb, and any `close:` line closes a day plan, which is how PK-336 closed with 10 lines open. that is for me to sharpen with wing 2 tmrw.

moved from PK-332, his word on collocating:
PK-332:W1 (2026-11-06 03:25, dima): remember to use the side channel as a way to unload your main thread, at least until we figure out if tilde will unload your own main lane well enough, so a side channel will be less needed. fold this into another side lane and a pocket item, so i will figure out how to solve it with the side channel as well.
the open part, with him: what makes it hold in practice, since a line alone decays: a boot step, a hook that offers the channel on a chore, a measure of how much left the main thread.

his raw drop, 16:55:
let's solve 336 starting from another point.

What happened yesterday? Quite a lot. First, we invented Wing's idea, and it very much changes the format in which it works, especially my approach of talking to main Clio and all Wings.

Wing's performance, functionality, and habits need to be steered first and shaped and groomed. Let's approach this topic from a higher level first. Since it's quite a bigger topic, let's postpone it until later because there are more chores that keep piling up, and I want to solve them.

Afterwards, we will do sharpening of how Wings operate and how it relates to main Clio, and decide who does what and when. We will also sharpen how Wings take care of the pocket items and the policy of assigning pocket items to Wings, and maybe linear tickets to Wings as well. Now we have multiple surfaces for who does what where: the main Clio and an infinite amount of Wings. I currently prefer two Wings at least. It should be enough.

Why do I have this? Because main Clio is always overloaded, and her main thread does not keep up. That's why I invented a model of having multiple Wings that are essentially the same Clio but allow us to balance the load across the main lane and each Wing. That's why we solve chores with you now. Main Clio is busy coordinating currently. I said that Clio is responsible for coordinating most of the lanes, and chores are currently solved with you, Wing 2.

We solve chores because a lot of tails piled up. Wing 1 currently solves a CPU-related issue, and it maintains its own lane. It is an exception. Usually, a Wing is not preferred to operate its lanes, but it is possible in exceptional cases or if it just fits. For example, this is when the CPU roasting problem is quite narrow and specific. I made Wing 1 the owner of this issue, so it solves it.

Main Clio operates the mods lane and the CI lane while also solving some other operational stuff while it's not very busy. This is an idea: currently, I change how the fleet operates until we have tilde —

Tilde is a plan. Another point of loading Maincleo: Tilde will do coordination stuff, and this way will unload Maincleo even more. This is a plan.

Until we have that, let's groom the current picture while we make the transition. We have to decide who does what and define clear boundaries so nothing gets drifted.

The most important parts are the work trees because each wing works in work trees, and drift happens quite a lot because each wing can change its work tree. Mainlio changes main, so syncs between main and wings' work trees have to happen frequently in both ways: by merging worktree into main and main into worktree sync way.

--
Fold all of this into a pocket item «clio: winged v2». It will be a story about revamping the new approach with Winged Clio and collocating all other pocket items and tickets that are related to this area into one pocket item story. You are an owner of this pocket item. We will solve it a little bit later.

pass closed: PK-352 and PK-336 updated

moved from PK-332, the rest of its lines:
PK-332:W2 (2026-11-06 14:23, dima): i'd like your habits updated so we make this split habit-based. whenever i start clio from scratch, clio should know that lane activities are preferred to be run by main clio, and all side chores, grills and other stuff are delegated to the side channel, the model we did today. consult main clio on how to make it work well.
PK-332:W3 (2026-11-06 14:28, dima): so main clio's lane is treated as a coordination lane, and your side channel as the main lane, where we solve all the chores and stuff like today's scope.
PK-332:W4 (2026-11-06 14:23, dima): how do you store your durable plans so they survive between second winds? i vote for the pocket, because i can see it; maintain it as an easy-to-read checkbox list.
PK-332:W5 (2026-11-06 15:43, dima, his tick o31): fix: side prompts join the prompt log. pocket-check reds every side fold today, since prompt-groom and the fold check read the day's prompt log, which side prompts never reach; a no-wish line clears --day, not pocket-check. 7 reds on closed PK-323 until then.

PK-351:W18 (2026-11-07 17:06, dima): idea: rethink how clio's lanes are named. currently only «main lane» exists, but we have no name for the wings' lanes.

PK-351:W19 (2026-11-07 17:09, dima): how do we ensure all wings' worktrees are synced both ways with main often? the outdated state is real and not good.

PK-351:W20 (2026-11-07 17:23, dima): we need a way to properly have a «day plan» for all clio lanes. it is the main execution plan for each clio lane, and now it is only named «day plan». groom this formula and invent a clean, cool vibe name for such clio lane plans, so they are distinguishable and easy to understand, treated as the source of truth, always fresh and synced, never forgotten; and we need a spec about their lifecycle.

2026-11-07 17:40 wing 2: a helper-lite card spawned from a wing has its Bash refused by the fork guard, on plain rg and jq reads under ~/.claude/projects, with the message asking it to make a worktree. seen once; a wing's read cards may all hit it.

PK-351:W21 (2026-11-07 17:40, dima): when you approach this item, rethink the whole flow for including all clios and the balancing on all surfaces.
PK-351:W22 (2026-11-07 17:40, dima): the main wish here is to properly set the boundaries between all clios and ensure that some kind of handshake is present, so all wings are on the same page.
PK-351:W23 (2026-11-07 17:40, dima): the worktree things and cadence are set up and never forgotten; worktrees and main should be synced as much as possible.
PK-351:W24 (2026-11-07 17:40, dima): we need a way for all wings to be aware of what the other wings do. anytime i ask any wing about state, anyone should be able to know what's happening in each clio lane.

2026-11-07 17:48: PK-343's red seen again: taking the wing label off PK-326 at a handover redded the groom check on a wing's prompt; the line now carries its orbit steer's stamp.

2026-11-07 18:03 wing 2: the pocket's auto-commit hook runs in main's session only, so a wing's note rewrite stays red as «note line gone since HEAD» until main's next pocket write commits it.
<!-- SECTION:NOTES:END -->
