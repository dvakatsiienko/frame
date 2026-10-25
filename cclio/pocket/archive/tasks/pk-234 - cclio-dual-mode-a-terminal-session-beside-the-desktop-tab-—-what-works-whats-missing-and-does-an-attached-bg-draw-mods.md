---
id: PK-234
title: >-
  cclio dual-mode: a terminal session beside the desktop tab — what works,
  what's missing, and does an attached --bg draw mods
status: done
assignee: []
created_date: '2026-10-21T11:40:00Z'
updated_date: '2026-10-25T14:13:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-21 14:40, folded: in a native terminal (no desktop app) mods work and draw, they just look different; the --bg board is only invisible in the desktop app. so cclio should work in --bg / terminal mode as well, like ccrow gets both modes (o2).
? probe: does `claude attach` to a --bg session draw orbit and phases (fleet-mods says a --bg board goes undrawn — measured in the desktop app only, 2026-10-11)
? the desktop-only doors cclio leans on: ccd_* session tools, the browser pane, SendUserFile, wrap_up, artifacts open — which have a terminal stand-in
? ccrow's relay and keep-hot assume a desktop cclio — check wake.ts and relay.ts for the terminal path
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: rides the low tide beside ccrow's dual-mode (o2)

**waiting for:** the coordinator review (PK-90) and the pm revamp (PK-103) — dima's o81, 2026-10-21 17:45
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

ticket: FRM-457
close: no W-lines — to FRM-457 (dima o75: actual, to be resolved)
<!-- SECTION:NOTES:END -->
