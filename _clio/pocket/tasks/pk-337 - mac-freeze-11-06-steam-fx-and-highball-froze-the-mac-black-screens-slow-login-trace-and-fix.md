---
id: PK-337
title: >-
  mac freeze 11-06: steam fx and highball froze the mac, black screens, slow
  login: trace and fix
status: open
assignee: []
created_date: '2026-11-06T13:39:00Z'
updated_date: '2026-11-07T13:35:00Z'
labels:
  - m
  - wing-1
dependencies: []
priority: now
type: task
ordinal: 9996
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PK-337:W1 (2026-11-06 15:38, dima): a wisp. i was messing with the steam fx app and the highball app. steam fx went asleep from yesterday and i resumed it, while clicking around highball's own built-in steam. then my mac overloaded and froze, then black screens on both laptop and monitor. i had to force shut down. after reboot i signed in and the black screen on both displays was still there, so i was locked out. then i disconnected the external monitor and force rebooted again. login took ~2-3 min, unusually long, it was faster before.
PK-337:W2 (2026-11-06 15:38, dima): everyone stopped and clio had to create dupes for everyone; consult with her if everything correctly resumed.
PK-337:W3 (2026-11-06 15:38, dima): i don't like this case. once current stuff is solved, before moving to the next plan item, let's trace the cause and fix it, i don't want freezes like this.
PK-337:W4 (2026-11-06 15:38, dima): also, why did the mac start to boot for so long? ❓
his photo 15:36: the lock screen at 15:29. trace started 15:39 by a researcher, findings at the side channel's tree .scratch/mac-freeze/findings.md.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-06 16:08 side channel: dima filed the WindowServer report with Apple, FB25461148. fixes so far: firelink's vm rules landed; FRM-517 in its quick lane; reboot timing after it lands.

⏰ PK-338 (full wish ids), dima's o69: this item stays bare until worked; the next touch sorts it first: W1–W4 share one line, split them, then its lines get full ids.

2026-11-07 wing 2, PK-350: the ⏰ PK-338 sort above is done, ids are full; that note is history.
<!-- SECTION:NOTES:END -->
