---
id: PK-60
title: "grill 2: the \U0001F6FC lane mod as global state, cclio writes, every board reads"
status: done
assignee: []
created_date: '2026-10-11 16:23'
updated_date: '2026-10-11 17:22'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: now
type: grill
ordinal: 2100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
grill 2 of 3 (dima o171, 19:12): the 🛼 lane mod reshaped. dima, 19:04 (folded): «i want the lane tracker in your thread — when a lane runs i usually keep only your thread open. render it in all threads as global state, so any thread can show it to me, but only you manage it, because you're the coordinator. more than one lane can run (a mods lane, a cli lane), each a card on every board.» on o170: «lane tracker probably only for you, since only you manage it — how would lane progress help the lane itself (coder, verifier)? i think no.»
his --bg worry, o176 (folded): «when you spawn a cli coder it will be a --bg session, and i won't see its pending orbit asks. not good at all. spawning every coder by hand in a desktop tab is clunky and slow, and you cannot rename the session. i don't know how to solve it; let's try your proposition (own orbit + a ping to cclio) and see how it goes.» idea for the grill: cclio's board also shows every member's open asks, read from their orbits.
FRM-385 is parked on it.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
grill 2 round 1, dima 19:42: Q1 member asks show under their lane's card, never copied into cclio's orbit («let's try, but how will asks show in the lane card?»); Q2 the lane card is expanded by default, with a lane-asks subcard folded by default that carries the asks count (his shape: «a lane mod card has a subcard with lane asks … folded by default, so i open it only when i want to peek»); Q3 reuse today's orbit rows and lane card, look card first; Q4 one global lane file, only cclio's orbit tool writes it, a member's write refused; Q5 lane cards render on every board, never in a member's context; Q6 orbit rows compact: pick + buttons on one row. open: the data flow (round 2).

grill 2 round 2, dima 19:49: Q7 lane asks linked by session id, read live from each member's published orbit, linked once at spawn, never synced; Q8 attach mode, never a wake (folded): «orbit asks work in attach mode — i tick take or redo, and every answer joins the next prompt or your mid-turn on its own, so i never spam you with turns. if i answer in a lane orbit and you transfer it into that thread as a wake, it causes the same redundant turns. ideally the lane orbit asks are linked to each thread's asks: when i agree, disagree or note an ask in the lane tracker, it appears in that thread.» door: the easiest, most efficient one, the fewest hops (his vote); Q9 cclio's ops are an orbit tool op lane (create, link, step, end), about 4 calls a lane, no per-turn checks; the lane card holds one orbit per member, the coder's first («he asks more questions»), the verifier's second.

grill 2 round 3, dima 19:52 («okay, let's try like this»): Q10 a lane tick writes the member's own orbit entry (asks:<sid>), one hop, attach mode, joins its next turn; Q11 an idle member blocked on a tick → a passive line in cclio's next turn, never an extra turn; Q12 lane steps seeded from the ticket's exit lines, cclio ticks each after verifying; Q13 the ccrow strip leaves the lane card, its own ticket later. frontier empty → reseal FRM-385.

ticket: FRM-385 — resealed 19:56 (blind critic 20261011195413: 4 findings folded, finding 1 open as the idle-member wake ask); coder resumed on step 0 + exits 1, 2, 4, 5, 6.

done 20:23: FRM-385 built (step 0 + exits 1–6, coder parked); only dima's look (exit 7) is left, held in orbit.
<!-- SECTION:NOTES:END -->
