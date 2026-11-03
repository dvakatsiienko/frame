---
id: PK-306
title: x-mod-stash steer box loses typed text on redraw — research, then fix
status: done
assignee: []
created_date: '2026-11-03T10:45:00Z'
updated_date: '2026-11-03T11:23:00Z'
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

raw drop (2026-11-03 12:45, dima): There is another wishkeeper, the one related to a steer box in a board. When I enter text there and the redraw happens by any trigger, the text still gets deleted occasionally, not always, though, which is bad. It is a very unpleasant issue. I want it to be fixed.

raw drop (2026-11-03 12:45, dima): First, let's research, because code there has already tried to fix that about five times, and it's still present. Maybe it is already issued somewhere on GitHub. If so, let's find existing tickets, and maybe there are workarounds. I want it to be fixed.

raw drop (2026-11-03 12:45, dima): How does it happen? For example, right now everyone is parked. Only the coder is active, but the board still gets redrawn, I think because of coder changes. When I print into a steer box in Orbit, the text that was printed after the previous redraw occasionally gets swiped by the next redraw, but it doesn't happen always. It happens sometimes, and it's very hard to catch because it doesn't happen always. It's hard to show you via a screenshot because it doesn't fit in a screenshot.

raw drop (2026-11-03 12:45, dima): TL;DR: the issue is still present.










raw drop (2026-11-03 12:45, dima): *  💡 folding them per chunk at its pre-merge 🌤️ siesta would keep the pile from growing. That would fit the same rider ← Yes, piled-up retros are useless because you lose precision when you process them in such large volumes at once, so let's have them more granular (more often).






ticket: FRM-492
close: W1768–W1780 moved → FRM-492's wish block (signed o37), a priority rider at the head of mods lane 4's slice 08

close: moved → FRM-492: W1768 W1769 W1770 W1771 W1772 W1773 W1774 W1775 W1776 W1777 W1778 W1779 W1780
<!-- SECTION:NOTES:END -->
