---
id: PK-343
title: >-
  wing hand-back: a label off an item with same-day wish lines reds the groom
  check
status: done
assignee: []
created_date: '2026-11-06T20:00:00Z'
updated_date: '2026-11-07T15:59:00Z'
labels:
  - xs
  - wing-2
dependencies: []
priority: later
type: task
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
a wing's prompts reach no log. seen once, 11-06 on PK-327. the fix to weigh: the groom check reads a wing's fold as groomed for that day, or the hand-back carries a no-wish line.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: fixed on dima's o102 at main: clio:boot lists a closed wing's labelled items for main, clio:halt hands them back.

22:32 reopened, wishkeeper: o102 shipped in clio:boot and clio:halt, but the red itself stands: a label off an item with W-lines from a wing's prompt still reds the groom check. a closed item keeps its label, so only an open hand-back bites. the fix to weigh stays the description's.

close: fixed on dima's go, 11-07: pocket-check passes a stamp whose minute the day's prompt log lacks, so a wing's line stays green after its label comes off; a logged minute and an orbit steer stay owed. test red-proven; proven live on PK-326.
<!-- SECTION:NOTES:END -->
