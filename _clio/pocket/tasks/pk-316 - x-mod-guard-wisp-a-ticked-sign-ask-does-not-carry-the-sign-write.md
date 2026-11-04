---
id: PK-316
title: 'x-mod-guard wisp: a ticked sign ask does not carry the sign write'
status: done
assignee: []
created_date: '2026-11-03T19:20:00Z'
updated_date: '2026-11-04T13:34:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
21:17 dima ticked o137 «✍️ sign FRM-502: …»; every x linear body --set that added a ## signed line was still refused «ask dima to tick», and the guard store (~/.claude/plugins/store/x-mod-guard_inline-*.json) held no tick or spent key at all. suspects: the tick never reaches the guard's TICKS state (hooks/register.ts tickFor, ~:671), or the parallel orbit resolve in the same step cleared it. blocks FRM-502's sign line.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
21:22 root cause (likely): the 4th sighting today (flawlog 10:27, 10:40, 14:24, and 21:17) — I resolved o137 in the same step as the sign write; tickFor reads only open ticks, so a resolved one carries nothing. fix candidates: the guard keeps a tick valid for its TICK_MS after resolve, and one tick covers a correction write; or a sign verb that waits for the tick, computes the hash from linear (sign-hash.ts) and writes once — the 20:39 jq wipe and the hash drifts are the same door. second sighting = teeth: a guard/verb fix, never a memory line.

21:22 dima asked guard or verb → clio's pick, the verb: x linear sign FRM-N waits for the tick, hashes linear's stored form, writes line + label once; the guard narrows to refusing a hand sign line and naming the verb. new surface → ⚖️ worth it section before the build (mods/cli lane).

10:47 2026-11-04: a tiny ✏️ write on FRM-478 (closing word above ## signed, one appended ✏️ line, hash recomputed) was refused «ask dima to tick an orbit ask ✍️ sign». its sign block has lines after the run stamp, a shape the reader may take as a new sign (inference). the closing word went as a comment.

15:32 2026-11-04: not reproduced today: 10+ signed-body writes passed, re-signs with an open tick, tiny ✏️ lines, and the 4 parked closing words folded (FRM-478's shape included). the 11-03 refusals' common step was resolving the ask in the same step as the write; today's writes ran before the resolve. the verb is proposed dropped.

close: 2026-11-04 — verb dropped on his tick o58; shape-lane says a sign ask resolves after its write lands; a real refusal reopens it. the four closing words are folded.
<!-- SECTION:NOTES:END -->
