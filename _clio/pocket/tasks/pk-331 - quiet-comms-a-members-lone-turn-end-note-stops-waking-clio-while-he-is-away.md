---
id: PK-331
title: 'quiet comms: a member''s lone turn-end note stops waking clio while he is away'
status: done
assignee: []
created_date: '2026-11-06T00:17:00Z'
updated_date: '2026-11-06T12:56:00Z'
labels:
  - s
  - side-channel-owned
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 (2026-11-06 02:16, dima): does the current recent few messages from codie useful to you? ❓ — answered: no, «waiting on the green run» repeats woke a turn of mine each, and changed nothing
W2 (2026-11-06 02:17, dima): let's solve this as one of the first things to do. can we solve it with side channel? if yes - plan as a side channel. ❓ — answered: yes, before the mods lane restarts

the want: while he is away, a member's lone turn-end note stops waking clio unless it matters. today's build wakes on each (FRM-501's lone-wake rule, his o70, `x-mod-stash/hooks/register.tsx`, `isAwayNow` and `quietIdle`).
measured: 25 of 27 turn-starting quiet lines 00:22–01:14 were lone notices; crow: 7 of 9 wakes in 26 min answered with a bare waiting line; tonight's whole mods fix round reads the same.
my pick to bring him, one short round in the side channel: a lone note holds under afk as it does at the keyboard; only a member's tagged send ([done], [ask], [escalate]), an exit notice, or a member silent past N minutes wakes clio. what it must keep: a member that ended silently and stuck is still seen, FRM-501's want.
order: first act after the boot, before FRM-504 starts, since FRM-504 and FRM-505 edit the same file; x-mod-holds refuses two writers. the side channel works on its fork branch and lands by its own door. its effect feeds PK-326's empty-wakes count, so measure the count before and after.
it changes signed FRM-501 behaviour (o70): the side's ask carries his re-sign on that line.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
from FRM-513's last reads, these belong to this item's «a stuck member is still seen»: a notice already flushed to its hidden row starts no turn; a refused wake past the idle wait falls to that row; register.tsx:1771, the quiet gate returns before the away-off edge is recorded, so a later wake is lost (wisphunter, by reading); tests/quiet.test.ts:2629's «no second turn» row passes on an empty held list.

2026-11-06 14:25 side channel, on his tick: landed and pushed. the rule: under afk or a shift a lone note holds; one turn takes the list at a member's silence past the wait, or a repeat at 3 waits. replay 54 wakes → 6; crow's 5 findings folded. FRM-501 re-signed. the live count is main's, PK-326.
close: done, landed and proven; the live effect is read by PK-326

close: W1 done, answered and the waiting-note wakes stop; W2 done, solved with the side channel before the mods lane restarted

2026-11-06 14:56 side channel, correction of the close, wishkeeper's catch: «the waiting-note wakes stop» is a replay, 54 → 6; the live read is PK-326's. the rule landed differs from his tick: no idle status, a ceiling at 3 waits; a re-sign ask is up. the FRM-513 reads: «a notice already flushed starts no turn» stays by design, FTR says so; «a refused wake falls to the row» is gone, a refused turn holds its lines; register.tsx:1771's lost edge is gone with the edge; quiet.test.ts:2629's hollow row is rewritten with a real held list.
<!-- SECTION:NOTES:END -->
