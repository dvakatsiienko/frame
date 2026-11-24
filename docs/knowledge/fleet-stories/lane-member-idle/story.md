---
status: open
dates: 2026-11-23 → 2026-11-24
tickets: [FRM-683, FRM-288, FRM-692, FRM-693]
tags: [idle, lane, coordinator, park, wrong-call, hang-heal, second-wind, keep-hot]
fed-by: incidents
---

# lane members sat idle and nobody was told — 2026-11-23, four cases in one day

## what happened

the speak codie finished its own context reset at 15:39 and got its next message from clio at 16:22: 43 minutes with nothing to do, on a day dima was watching the usage and the pace. he caught it himself at 16:22 («why speak is parked for 40min?»). minutes later he caught the same shape on the mods lane: its codie was idle behind a spec clio had not sealed.

dima, 2026-11-23 16:26: this is bad. 40 min lost is a lot. they could already have finished the mess hunt and wisp hunt fixes.

- the wrong call is clio's, twice in one hour
- what it cost: 43 minutes of the speak lane, on the app he wants next

## the trace (the codie's transcript, message times; clio's thread)

- 15:38 the codie writes its handoff after the chords move (bytes#168 merged); 15:39 its last act. no next chunk is queued: the next one, the speak mess hunt's fixes (FRM-683), has no spec yet
- 15:46 clio starts the hunt as three reader cards in her own thread. the codie has no part in it
- 15:46 → 16:12 the readers run, the merge is written, the fix list goes to dima's board for his ticks
- 16:12 the fix spec is written. by his earlier word (FRM-288:W65) the highs and mediums needed no tick, so the codie could have started here. clio starts her fourth context reset instead
- 16:19 the reset; 16:20 his next ask; 16:22 he asks why speak is parked, and the codie gets read-only prep within the minute
- 16:35 the spec is sealed and the first seven steps greenlit, after the blind critic (5 findings), a wisphunter read (12) and the codie's own 14 contradictions were folded

## the second case, the same hour: the mods lane

- ~15:00 the mods codie reads its next chunk (FRM-658) and leaves six open points for clio in its lane plan; 15:55 dima re-signs the chunk. the sign is there from then on. the sealed spec is not: clio writes no section, no exit lines, answers none of the six points
- 16:18 the codie's last act on the chunk before it; idle from then
- 16:34 dima asks «what blocks mods lane?». no ask of his blocked it. 16:35 the codie gets work only because main's CI went red on its last fix
- 16:47 the section is written, six exit lines, the preflight passes, the dispatch applied, step 1 (measure first) greenlit: twelve minutes of work that had waited an hour and fifty minutes
- what was missing was never his sign. it was clio's seal, which needs nobody but clio

dima, 2026-11-23 16:45: i find myself always pushing on you to sign tickets, especially when we finish the day and do the halt. you always want to postpone signing tickets and sealing your specs until tomorrow, which leads to this picture: we boot and spend 1 or 2 hours on prepping the plan for a day and only then start, instead of starting right on the boot.

the habit behind both cases: clio treats the seal as the step before a dispatch, done when a member is already free. so every chunk boundary and every boot opens with a member waiting on her paperwork.

## the third case, the same evening: a reviewer parked two hours with no wait named

- 16:17 the mods sixth sense's last real act (FRM-596 clean, round 2). parked from then
- 17:07 and 17:57 its only turns: the board mod's keep-hot ping, each answered with one character, 50 min apart
- 18:34 dima reads the two «.» in its thread and asks why it has been parked for two hours
- the wait had a reason: a reviewer works on a builder's «final», and the mods codie sent none all afternoon, its chunk (FRM-658) being measurement. the reason was named nowhere dima could see: no 🔭 line, no glide note, no line from clio
- the wrong call is clio's: a member parked past an hour got no named wait and no read-ahead work (the two commits already on main were readable from 18:17)

## the fourth case, minutes later: a second wind that never fired

- 18:32:33 the speak codie ends its turn on «i take the second wind now», its handoff `speak-hunt-2` saved
- no compact follows. 18:39:35 its transcript logs «x-mod-stash: reloaded»: the mods lane had pushed (the prune, the weekly fix), and every session's board mod reloaded
- 18:41 dima asks «speak codie stuck with SW for 10min?». 18:42 clio finds the handoff untaken in the store and tells the codie to call the reset once more, else carry on
- the cause, from the codie's own retry (18:45): it called the `second-wind` op with `pending: none` while a background Monitor on its pr was still running, and the compact never fired; with the Monitor stopped, the same call compacted and ingested. the op answered the same words both times, so the member could not tell. clio's first guess, the mod reload at 18:39, was wrong
- nobody's wrong call; a hole: the op accepts a reset that a live background task will hold forever and says nothing, and no alarm reads «a member said second wind N minutes ago and its handoff is still in the store»

dima, 2026-11-23 18:43: another case of a hung crew member. it starts to appear too often now. how to solve this?

## why nobody saw it

1. **the plan put the member behind the coordinator.** hunt, merge, his ticks, spec, seal, dispatch ran in a row, every step clio's or dima's. an idle codie was the plan working as written
2. **the alarm existed, and its condition missed every case.** the stash mod wakes the clio running a lane parked 10 min, built 7 Nov for this slip. FRM-602 narrowed it to «the next chunk is unsigned»: a chunk signed but unsealed (cases 1, 2), a reviewer waiting on a builder's final (case 3) and a member whose own reset never fired (case 4) all sat outside it. the lane's card showed step 3 of 5, his; nothing on any surface says «a member of this lane has had nothing to do for N minutes»
3. **the rule that existed was not enough.** «a member that parks gets the next signed chunk the same turn» covers a chunk that is ready. this one was not: the gap between «parked» and «sealed» had no rule and no owner but clio's attention, and attention is what runs out (`method-silent-failures`)
4. **the reset went first.** at 16:12 the choice was the seal or the second wind, and the reset won because the context mark said so. a member waiting is not on that scale

## what changed

- a rule, 23 Nov: a member never idles on the coordinator's spec work. its next chunk not sealed means a read-only prep steer the turn it parks (the code read, the open probes, the test harness), and the seal is the coordinator's next act (`clio:shape-lane-dispatch` § 6)
- the prep paid at once: the speak codie's probes settled three open questions of the hunt and its read found 14 contradictions in the spec before any code moved
- the alarm already existed and stayed quiet (crow's catch, 16:50): the stash mod wakes the clio running a lane parked 10 min, built 7 Nov for this same slip. FRM-602 narrowed it to «the next chunk is unsigned», so a chunk signed but not sealed woke nobody, and neither did the gap between one lane card ending and the next starting. the fix is that one condition (wake when the next chunk is not dispatched, and when a card is finished while its members live), not a second alarm

## the line that keeps it away

an idle member is a cost someone must be told about. the coordinator's own work (a hunt, a spec, a reset) never counts as a reason for a member to wait: the member gets prep, or the wait is named with what it waits for.

## the fifth case, the next morning (24 Nov): two codies behind one test queue

- 12:18 the speak codie starts its 28 planted faults (it breaks its code in 28 places, one at a time, and reruns the daemon's swap test each time, about 45 s a fault) as ONE turn of the mac's shared long test queue (`script/gate-queue.sh --long`, one long job at a time)
- 12:20 the mods codie has its seven review fixes written and queues FRM-692's whole run; it sits behind the speak batch, and its own waiter also wants the 1-minute load under 7 while the load is 10 to 16
- 12:22 clio hands the stray a go chore; its tests in the vm push the load to 14
- 12:34 dima asks why the mods codie has been parked 11 min; clio's first answer names the load, the second read (12:41, `ps`) finds the queue
- 12:45 dima: «we just lost 40m cumulative time for 2 codies because of those waits», «so mods codie is parked for an hour just because of miscoordination. you could spot this and tell mods codie to do something else»
- the cost: about 40 min of two Opus 5.5 codies waiting, and five turns of dima's attention
- the wrong calls, all clio's: no read of the queue after the summons; a go chore given to the stray beside a lane about to need a calm mac; no «work on while you wait» line in either brief
- what the fault run was worth: it found one survivor, a hole in the swap test, fixed with one test row before the merge

## still open

- the wake's condition, widened to all four cases, is FRM-692, re-signed 23 Nov 19:00 and re-sealed that night, first in the mods lane on 24 Nov: a member of a running lane idle 10 min with no named wait wakes its coordinator, whatever the reason
- the `second-wind` op says what holds it: `wind-run.ts:387` finds a live Monitor and stores the wind as blocked while the member was told «the refresh runs on its own». the fix rides FRM-692. crow's catch (19:07): the morning's cc read already named this («a watch holding a second wind»), clio called it «nothing to change» at 11:00, and `crew-codie` orders one persistent Monitor per open pr, so every codie with a pr open could not wind at all
- until that lands: a member stops its pr Monitor before a second wind and re-arms it after the pickup (`clio:wind-down` step 5)
- a reviewer waiting on a final reads what is already on main after 30 min

- a hunt run by `x:review-messhunt` has no step for the lane's codie; whether the codie should read along from the start is a line for that skill
- a context reset at 55 % has no check for «is a member waiting on me»
- the shared long queue has no cap on one turn and no word to the lanes waiting behind it; a member's own load bar (7) is stricter than the queue's (14). dima's steer on the cap, 24 Nov: «are you sure it is a true solution for the root of a problem»: not decided, he has no time for it now
- a fault batch runs once a slice, before its merge (seven slices in the speak hunt): how often, and whether it runs beside the codie's next slice by default, is not decided
- since 24 Nov, by message, not yet a skill line: a member never sits on a load or queue wait, it works its next step; a fault batch takes one queue turn per fault

