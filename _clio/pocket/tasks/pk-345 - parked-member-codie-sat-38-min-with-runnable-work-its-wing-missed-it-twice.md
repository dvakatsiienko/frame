---
id: PK-345
title: 'parked member: codie sat 38 min with runnable work, its wing missed it twice'
status: open
assignee: []
created_date: '2026-11-06T23:27:00Z'
updated_date: '2026-11-07T02:49:00Z'
labels:
  - s
  - wing-1
dependencies: []
priority: next
type: task
ordinal: 18999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-345:W1 (2026-11-07 01:23, dima): your codie was just parked for a whole 40 mins!
PK-345:W2 (2026-11-07 01:25, dima): trace why it happened. it is very bad. fold a detailed pocket item for tomorrow with an exact snapshot of the problem: why codie parked and how you missed its parked state. and propose how to solve it.

## the snapshot, read from codie's transcript 6cd71c69 and wing 1's, clock UTC+2
- 00:39:26 wing 1 orders the wind: «finish the step you're on with nothing half-run … write your handoff … and wind. after it: …». every next step is worded as after the wind
- about 00:40 exit 5's protocol starts in the background: 16 go runs, base against base then base against head, each behind the --long queue, up to 729 s of wait a run
- 00:44:52 codie calls orbit second-wind with pending naming the protocol, exits 6, 7 and the pr
- 00:44:52 the mod answers: «not yet, pending: …; resolve it and park everything, then call again with pending: none» (x-mod-stash hooks/register.tsx:3391)
- 00:44:54 codie: «I'm not winding yet … When it finishes, I'll fold its numbers into the handoff and wind then.» ends its turn, 🔭 waiting on exit 5's protocol
- 00:45 to 01:23 no codie write. exits 6 and 7 and the pr needed nothing from that run
- 00:45 wing 1 reports codie «mid second wind» and arms a Monitor on new commits or a pr only: it cannot see a park. it expires 01:16 with no event, and is re-armed the same
- 00:55 wing 1 reads the transcript: last write 00:44:57, ten minutes stale, the «not winding yet» text in hand; tells dima «19 min into the before/after run … the pr come after that», as normal
- 01:03 dima asks about the wind at 61 %. wing 1 reads it again, 18 min stale; tells him «it's idle meanwhile, so its context isn't growing», framing the park as a plus
- 01:23:16 dima in codie's tab: «why are you parked for 40min?» dima caught it, no member did
- 01:23:40 codie calls second-wind with pending: none. it fires with the protocol still running; 01:23:53 compact
- 01:25:04 the protocol's next row lands after the compact: a background run survives a wind, so it never needed to hold one

## why codie parked, three causes that met
1. the order: wing 1 worded the rest of the lane as after the wind, at 61 %, with nothing urgent
2. the refusal: the wind's graceful rule says resolve and park everything; codie read that as a stop for all work, when only the compact had to wait
3. no contract line: crew-codie says heavy runs go in the background, and none says the steps not needing that run keep going. rules/fleet-output-format.md even names a background job as a true hold for 🔭

## how wing 1 missed it
1. first-act skipped: wing-1-7's first-act 2 named x:crew-lead's watching.md; at the 00:45 ingest wing 1 read the spec and plan only. watching.md:15 says a hang is the coordinator's to break, :17 says run idle-check.ts on every wake, a ⏳ is a stall, :18 says re-subscribe notify_when_idle after every compaction. none ran
2. wrong question: both reads asked «is it alive» and «what does it cost», never «what could run now and isn't»
3. no signal: a wing has no glide card and no quiet gate, so its member's notes are the only wake, and a turn end sends none; the Monitor watched outcomes only
not checked: whether the fleet's silent-member alarm fired at all for this lane

## exit 5's own cost, a spec miss of wing 1's
16 runs at about 390 cpu-s is about 6,240 cpu-s on a saturated mac, and up to 3.2 h of queue wait; the spec sealed it with no time estimate, and its own runs add to the load it measures.

## proposed, in order, none built
1. the wind stops parking work, x-mod-stash: the refusal says the compact waits and the work does not: do every step that does not need the pending run; a background run started earlier need not block, proven above. one string and its test
2. a member's Stop gate: a turn ending 🔭 on its own run with unchecked steps in its lane plan is refused once: name the next step that does not need it, or say why none can run. catches the park at its minute, with no coordinator. new surface: needs its ⚖️ worth it and 🔌 caller
3. the coordinator's watch, any wing or main: idle-check.ts on every read of a member, notify_when_idle on every message to it and after each compaction (done for codie tonight, after his catch), a Monitor on the member's transcript age, not only its commits
4. the words: crew-lead's wind order says a wind is a context reset, keep working; crew-codie gets the beside-it line; 🔭's «background job» only when nothing else can run, a rules/ edit needing his word
5. a measuring exit states its run count and time at seal
done test, a replay: a member with a pending background run and open steps gets a wind order, and its next commit lands inside 5 min

PK-345:W3 (2026-11-07 01:38, dima): will the auto second wind mod solve this? ❓
answered, in the thread 01:39, read from FRM-505's wish: no, partly. it removes the coordinator's order, not the refusal; its W1 says the thread parks and solves its tails first, so it could park more threads. FRM-505 needs proposal 1 in its scope, main's call. his tick o91: proposal order stands, tomorrow.

from 11-07's retros: a --long protocol of 16 runs waits up to 729 s a run, and frm-521 codie parked on it twice, dima and wing each caught one: a queued run is no reason to end a turn; open the pr, rows join by edit.

his 11-07 04:48: maybe quiet comms is too quiet? read that minute: held messages p50 under 1 min, max 8.3, 0 lost (115 of them). the risk left: 177 lone notices logged, read by nobody, and this item's 38 min. to do: read a sample of those 177 for a parked member or a question, and name what a turn-end note must carry to pass.
<!-- SECTION:NOTES:END -->
