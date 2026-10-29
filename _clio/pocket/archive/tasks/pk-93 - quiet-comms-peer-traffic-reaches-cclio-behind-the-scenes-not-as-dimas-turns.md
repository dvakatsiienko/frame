---
id: PK-93
title: 'quiet comms: peer traffic reaches cclio behind the scenes, not as dima''s turns'
status: done
assignee: []
created_date: '2026-10-12 11:40'
updated_date: '2026-10-13 15:33'
due_date: '2026-10-19'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100090
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-12 14:37: coders, verifiers and ccrow message cclio through the cross-session api; each lands in my thread as a turn from me, clutters it and makes you do a turn. can a mod give you behind-the-scenes comms with everyone, at full scale, no drawbacks, the technical traffic invisible to me? 14:40: hidden pings wait for your next turn — I'd expect some trick or tradeoff for that; quick probe with a coder. home: PK-50 step 3 (mods that solve the comms issues). probe brief: .scratch/quiet-comms/brief.md; report lands at .scratch/quiet-comms/probe-report.md.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: queued under the ≤5 open cap; the probe runs now in dima's mods coder tab (o7)

dima 14:48: in mobile mode every thread switches fully to mod-less comms — so quiet comms must pass every peer message through while mobile mode is on (the board that would hold them is out of his reach); mobile-mode SKILL.md today covers orbit asks + phases only, not 🔭, the glide card or the sessions card

16:03: built 8d59213f (x-mod-stash, cclio's thread only, arm by day, /quiet on|off|auto, 🤫 n on her row, quiet-log store lines); desktop hold proven 15:48; mods:test exit 0 on cclio's run. trial live to 10-19 in docs/test-drive/quiet-comms.md

dima 16:12: o33 a 🎛️ quiet switch in the board panel beside /quiet — yes; o34 🤫 n expands to the held pings (who + first line) — «let's try». queued as mods-lane riders after brief 4; dima will ask about the quiet mod himself (reminded by cclio after x-mod-primer is sealed)

dima 16:53: the day a/b is redundant — quiet runs every day as a stress test, more data (/quiet off stays the revert); the idle append time becomes a mod setting, 10 min to start (15 maybe); 🤫 n shows only while something is held; quiet works only in cclio's thread, never in a session dima spawns himself. riders to the mods coder as brief 5 with o33 🎛️ + o34 🤫 n expand.

19:26 landed since 16:53: brief 5 (always on, idle setting, 🎛️ switch, 🤫 n opens, 4f355749…d6b7b30d), the cwd wisp (registry name), the safety net (fail open, ledger, stuck alarm, canary; 3042a2e3, 92842908), the ccrow false-red fix (bc199a57), live pass 17:11. left: brief 9 item 2 (no silent loss on a failed save). test drive runs to 10-19.

18:34 dima asked to review: built and live since 10-12 (brief 5 + safety net); the one open line, no silent loss on a failed save, is mods todo 23 now; the trial runs to 10-19. closes when 23 lands.

18:34 done: the last line was already built (965a3729, 10-12), its test red-proven today by the coder; the trial runs on to 10-19 in docs/test-drive/quiet-comms.md
<!-- SECTION:NOTES:END -->
