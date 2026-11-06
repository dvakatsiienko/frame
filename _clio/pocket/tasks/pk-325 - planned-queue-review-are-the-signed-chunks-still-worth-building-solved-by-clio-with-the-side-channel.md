---
id: PK-325
title: >-
  planned-queue review: are the signed chunks still worth building, solved by
  clio with the side channel
status: open
assignee: []
created_date: '2026-11-05T21:51:00Z'
updated_date: '2026-11-06T20:06:00Z'
labels:
  - s
  - wing-3
dependencies: []
priority: next
type: task
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
extracted from PK-321 on dima's word 11-05 23:51: tomorrow, main clio with the side channel. cli pass (_clio/.scratch/worth-it-pass.md) read 9 of 26 signed Todo; 17 unread: FRM-511, 11 fleet, 5 bytes; 24 unsigned Todo out of scope unless he widens it.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1308 (2026-11-02 17:37, dima): it actually would be a good idea to review what we planned because we could plan the redundant stuff, but let's do it a little bit later.
W1312 (2026-11-02 17:37, dima): then proceed with what we planned and planned scope verification against needed or not.

from PK-321's close, 23:58, unanswered, joins this review: W1411 (2026-11-02 18:59, dima): why don't coders use it, and how to make coders use them? ❓

⏰ PK-338 (full wish ids), dima's o69: this item stays bare until worked; the next touch sorts it first: W1308, W1312 also live in PK-321, PK-299; W1411 sits mid-prose, then its lines get full ids.
PK-325:W1313 (2026-11-06 19:08, dima): do you have any tails? let's solve something with you. pk-325. there were some ticket about revisiting

PK-325:W1314 (2026-11-06 19:08, dima): previously planned chunks for mods and CLI. We invented a worth-it check at some point, but some chunks were created long ago before that worth-it chunk.

PK-325:W1315 (2026-11-06 19:08, dima): Let's do a revisit of all chunks that we have for all lanes and see if all of the planned chunks are relevant, actually wanted, and actually useful. Let's groom them and ensure that they are all in good shape, nothing has drifted, and they all have good and correct bodies and integrity. Let's process everything through a worth-it check so all chunks are valid. Also, let's revisit the order and see if the order for all chunks is still actual. The new first chunks in the execution queue should go first, and less relevant chunks go last.

PK-325:W1316 (2026-11-06 19:08, dima): pk-325 is about that or what the ticket is? if 325 - take over it from wing 1 into your lane (wing 1 is busy with pk-328).

PK-325:W1317 (2026-11-06 19:31, dima): when revising the cli lane, propose the split: instead of one long queue for one cli lane, plan for two parallel cli lanes, like now, maybe even three; i think two will be ok. the mods lane is probably harder, because it has no worktree.

PK-325:W1318 (2026-11-06 19:32, dima): also tell how many total chunks are present for mods lane and cli lane.

PK-325:W1319 (2026-11-06 19:32, dima): plus — are actually all planned scope for all lanes are chunked? anything not «prepped» into a chunk? ❓

PK-325:W1320 (2026-11-06 19:42, dima): cli and mods — lets ensure all chunks are true. and all are passed worth it check and are signed and have proper execution order. you also would be good to SW tell when a good point.

PK-325:W1321 (2026-11-06 19:42, dima): let's proceed both lanes chunks relevance, trims, grooms. all chunks. then mods lane the same.

PK-325:W1322 (2026-11-06 19:42, dima): after SW? or now? ❓

PK-325:W1323 (2026-11-06 19:42, dima): for each lane tell why you propose trims/merges/moves/closes. i want reasons. make easy to read no tech details.

PK-325:W1324 (2026-11-06 19:52, dima): ok keep but consult with wing 1 — it fixes (pk-328) commit and red proof gates perf so chunks could drift. (wing 1 pk-328 still in progress). and maybe this one related FRM-435. ask wing 1 what it is about to change with pk-328 and compare against both cli and mods lane chunks scope so no conflicts. (i trust wing 1 - i want an optimized commit and red proof gates)

PK-325:W1325 (2026-11-06 19:52, dima): FRM-384, FRM-414, FRM-436 — i agree with proposal but worth a recheck about «goes»? ❓ you can read logs, re-measure and consult with active coders and verifiers if they actually would want it then make a weighed cuts proposals.

PK-325:W1326 (2026-11-06 19:52, dima): FRM-387 — Is this about my wish about CLI having some pretty stats board that utilizes charmbracelet tools? ❓ At some point, I wanted some pretty stats screen with graphics and charts, etc. Something like this.

PK-325:W1327 (2026-11-06 19:52, dima): i pre-approve but verify if all decisions are true and weighted. after confirm — groom all chunks so all fluff is dropped and all chunks are relevant up2date and pretty.

PK-325:W1328 (2026-11-06 20:14, dima): OK to your pick: tick the proposal, I take a second wind, I groom right after, then the mods round.

PK-325:W1329 (2026-11-06 20:14, dima): and with mods, same approach. first you gather verified cut proposals: measure and collect the data behind the «worth it» and cut calls, consult the currently active coders and verifiers, crow, and clio wing 1 and wing 2 for opinions. then propose the mods chunks revamp. and wishkeeper at some point.

PK-325:W1330 (2026-11-06 20:14, dima): FRM-414 cut: board screenshot, 0 uses in 14 days. what is the board screenshot? maybe it is not used because it is not wired? ❓

PK-325:W1331 (2026-11-06 20:14, dima): merge FRM-435 into FRM-474: timing tool, 0 uses. probe: FRM-383 covers that job. is it wired? maybe 0 uses because no one knows about it? ❓

PK-325:W1332 (2026-11-06 20:14, dima): wisp: clicking a SW (band) is lagged, it enables only after a while (maybe 100% cpu load, maybe not wisp). either way do a SW and a good point. i am not rushing you, but your context is not infinite: 66%.

PK-325:W1333 (2026-11-06 20:14, dima, o65 steer): i approve with few questions. after consulting with everyone, your proposal is much sharper. for once you fully solve the CLI part and move to mods chunks grooming. ensure you properly measure all surfaces needed for a weighted decision, and consult everyone about once-and-for-all checks for all mods chunks.

PK-325:W1334 (2026-11-06 20:07, dima): note: you are 62% ctx, and pk-325 is still mid progress. how to gracefully take over the full pk-325 scope after SW? would you solve it better with freed-up ctx, or can you solve it before SW? just asking. ❓

19:37 his ticks: cli queue splits in two lanes, gates and lanes (FRM-511, FRM-509, FRM-520, FRM-384, FRM-414) vs proof and screens (FRM-474, FRM-383, FRM-433, FRM-424, FRM-436, FRM-387, FRM-360); FRM-43 keeps a someday label; BYT-99, BYT-54 cancelled.


PK-325:W1335 (2026-11-06 21:27, dima): hold SW until wing 3 is good and no data loss is present. mods chunks scope is important to have precise integrity.

PK-325:W1336 (2026-11-06 22:06, dima): no, this one does not need a recipe. it is a skill. let's have it as a skill after PK-325 is fully solved.
<!-- SECTION:NOTES:END -->
