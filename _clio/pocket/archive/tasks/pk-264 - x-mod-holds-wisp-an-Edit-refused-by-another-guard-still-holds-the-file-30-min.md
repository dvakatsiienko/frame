---
id: PK-264
title: 'x-mod-holds wisp: an Edit refused by another guard still holds the file 30 min'
status: done
assignee: []
created_date: '2026-10-23T13:58:00Z'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.
the FRM-404 verifier (2026-10-23 16:53) had its Edit of docs/test-drive/verifier-break-pass.md refused by cc's bg-isolation guard, yet x-mod-holds took the hold; FTR.md:39 releases on clean only a hold whose edit landed and no release verb exists, so the file stayed locked for other writers until 30 min idle. dima ticked it as a mods-lane rider (orbit, 16:57).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.

ticket: FRM-428
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-428 carries this item (its body lists «pocket PK-264») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
