---
id: PK-441
title: 'mess hunt: a subagent card instead of the skill? weigh it'
status: open
assignee: []
created_date: '2026-11-16T12:15:00Z'
updated_date: '2026-11-16T17:42:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-11-16 inbox, dima; W-lines land from helga's inbox prep
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-441:W1 (2026-11-16 inbox, dima): moving the review mess hunting skill to a subagent card: i think it makes sense.

PK-441:W2 (2026-11-16 inbox, dima): alternative: a dedicated mess hunter skill.

PK-441:W3 (2026-11-16 inbox, dima): is a subagent card better than a skill, or should it stay a skill (a dedicated mess hunter skill)? ❓

raw drop (2026-11-16 inbox, dima): moving review mess hunting skill to subagent card. makes sense. (dedicated mess hunter skill). makes sense? better? or skill?

PK-441:W4 (2026-11-16 14:46, dima): let's process the mess hunt shape-idea via a dedicated turn, after the herdr cuts are done.

PK-441:W5 (2026-11-16 14:46, dima): my request about the herdr new explore surface topic is solved. I like your initial proposal.

PK-441:W6 (2026-11-16 17:36, dima): mess hunt as a card: shape, grill, implement in place.
PK-441:W7 (2026-11-16 17:36, dima): mess hunt flush: is the herdr mess hunt plan still valid and relevant? when to revisit: after egg basket is merged as main layout and migration is finished?

17:44 dima 17:44 on the herdr mess hunt's fix list: «let's review after egg-basket moves to my iTrout» (his main layout, «itrout» for brevity; «and we have a rename task btw»): no split now, no fix from that list before the swap; re-read it then, so nothing is paid twice

PK-441:W8 (2026-11-16 17:43, dima): mess hunt: verify somehow what is still relevant to fix and what is not. dima does not want double work. (same line as PK-349:W1056)

PK-441:W9 (2026-11-16 17:43, dima): review the mess hunt after egg basket moves to itrout (dima's name for his main layout). there is a rename task too. (same line as PK-349:W1057)

19:26 his o78 steer and 19:23 lines (round 2 is .scratch/mess-hunt/grill-2-proposal.md):
PK-441:W10 (2026-11-16 19:16, dima, o78 steer): ❓ with the proposed shape, can we then run this hunt with, for example, a verifier too, as a hunt runner? or is it just redundant and a card is better? i was thinking a mess hunt from roles like verifier could bring interesting results, given his aim (his skill).
PK-441:W11 (2026-11-16 19:23, dima): mess hunt. i rushed the tick. open questions.
PK-441:W12 (2026-11-16 19:23, dima): ❓ 1. top7 card name: messhunter? and top7 emojis.
PK-441:W13 (2026-11-16 19:23, dima): 2. its place in fleet identities.
PK-441:W14 (2026-11-16 19:23, dima): ❓ 3. its card settings: baseline model and effort, baseline memory or memory-less? other useful knobs?
PK-441:W15 (2026-11-16 19:23, dima): wait, it is actually a sound idea. propose more then, unfold this idea. (clio's line before ←: one thing my question missed (crow caught it): there is a cheaper door, which is to widen the existing 🐆 wisphunter card with a «no diff» brief instead of making a new card; i put that choice in round 2 with the card's name and model)
PK-441:W16 (2026-11-16 19:23, dima): grill q1. i'm not sure about extending wisphunter capabilities with this messhunter. why? because we use wisphunter very often for its current job, but mess hunting is a rare job. we do it when i feel that something is off under the hood.
PK-441:W17 (2026-11-16 19:23, dima): i think in the future we won't run it every day either. it will be maybe once a week at least, or even rarer. i wouldn't rush into flooding the wisphunter spec with these mess hunting details.
PK-441:W18 (2026-11-16 19:23, dima): on the other hand, the wisphunter spec would be a good base for messhunter, because essentially messhunter is wisphunter with an additional precise and good goal. having a wisphunter spec for the messhunter card would also be good.
PK-441:W19 (2026-11-16 19:23, dima): now i'm confused. propose how to solve all of this efficiently.

19:37 decided on his ticks (19:29): o80 a small new card standing on wisphunter's card, differences only, wisphunter gains one clause; o81 Opus 5.5 medium, memory-less, read-only, one card with the angle in its brief; o82 the name and badge 🦝 messhunter; o83 one line in rules/fleet-identity.md plus x:crew-subagent and the mess hunt skill. built 9a2ea76d; the probe: its first call read wisphunter's card. PK-441:W8 and W9 are this item's; their twins PK-349:W1056–W1057 carry a moved note

19:41 his 19:29 and 19:37 lines (the badge is free: retro wears 🦡; the rename is the stray's chore):
PK-441:W20 (2026-11-16 19:29, dima): ⭐⭐⭐⭐⭐ 🦝 messhunter: y. nice, but is raccoon already taken by the retro card, or is that different?
PK-441:W21 (2026-11-16 19:37, dima): x:review-mess-hunt → x:review-messhunt ?
<!-- SECTION:NOTES:END -->
