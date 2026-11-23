---
status: open
dates: 2026-11-23 → 2026-11-23
tickets: [FRM-683, FRM-288]
tags: [idle, lane, coordinator, park, wrong-call, hang-heal]
fed-by: incidents
---

# a lane member sat idle while its coordinator worked — 2026-11-23

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

## why nobody saw it

1. **the plan put the member behind the coordinator.** hunt, merge, his ticks, spec, seal, dispatch ran in a row, every step clio's or dima's. an idle codie was the plan working as written
2. **the board said «waiting for your ticks».** the lane's card showed step 3 of 5, his. nothing on any surface says «a member of this lane has had nothing to do for N minutes»
3. **the rule that existed was not enough.** «a member that parks gets the next signed chunk the same turn» covers a chunk that is ready. this one was not: the gap between «parked» and «sealed» had no rule and no owner but clio's attention, and attention is what runs out (`method-silent-failures`)
4. **the reset went first.** at 16:12 the choice was the seal or the second wind, and the reset won because the context mark said so. a member waiting is not on that scale

## what changed

- a rule, 23 Nov: a member never idles on the coordinator's spec work. its next chunk not sealed means a read-only prep steer the turn it parks (the code read, the open probes, the test harness), and the seal is the coordinator's next act (`clio:shape-lane-dispatch` § 6)
- the prep paid at once: the speak codie's probes settled three open questions of the hunt and its read found 14 contradictions in the spec before any code moved
- an alarm, on his tick (o13): at each of clio's turn ends, one line when a member of a live lane has been idle 10 minutes with no wait named. the first case of the hang-heal work (clio's flyway f77)

## the line that keeps it away

an idle member is a cost someone must be told about. the coordinator's own work (a hunt, a spec, a reset) never counts as a reason for a member to wait: the member gets prep, or the wait is named with what it waits for.

## still open

- the alarm is not built yet
- a hunt run by `x:review-messhunt` has no step for the lane's codie; whether the codie should read along from the start is a line for that skill
- a context reset at 55 % has no check for «is a member waiting on me»
