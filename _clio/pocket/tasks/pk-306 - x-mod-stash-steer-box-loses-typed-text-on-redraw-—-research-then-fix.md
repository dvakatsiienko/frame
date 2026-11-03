---
id: PK-306
title: x-mod-stash steer box loses typed text on redraw — research, then fix
status: open
assignee: []
created_date: '2026-11-03T10:45:00Z'
updated_date: '2026-11-03T10:45:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1768 (2026-11-03 12:45, dima): there is another wishkeeper, the one related to a steer box in a board.
W1769 (2026-11-03 12:45, dima): when i enter text there and the redraw happens by any trigger, the text still gets deleted occasionally, not always, though, which is bad.
W1770 (2026-11-03 12:45, dima): it is a very unpleasant issue. i want it to be fixed.
W1771 (2026-11-03 12:45, dima): first, let's research, because code there has already tried to fix that about five times, and it's still present.
W1772 (2026-11-03 12:45, dima): maybe it is already issued somewhere on github.
W1773 (2026-11-03 12:45, dima): if so, let's find existing tickets, and maybe there are workarounds.
W1774 (2026-11-03 12:45, dima): i want it to be fixed.
W1775 (2026-11-03 12:45, dima): how does it happen? ❓
W1776 (2026-11-03 12:45, dima): for example, right now everyone is parked. only the coder is active, but the board still gets redrawn, i think because of coder changes.
W1777 (2026-11-03 12:45, dima): when i print into a steer box in orbit, the text that was printed after the previous redraw occasionally gets swiped by the next redraw, but it doesn't happen always.
W1778 (2026-11-03 12:45, dima): it happens sometimes, and it's very hard to catch because it doesn't happen always.
W1779 (2026-11-03 12:45, dima): it's hard to show you via a screenshot because it doesn't fit in a screenshot.
W1780 (2026-11-03 12:45, dima): tl;dr: the issue is still present.
<!-- SECTION:NOTES:END -->
