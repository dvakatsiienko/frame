---
id: PK-311
title: 'side channel owns its pocket items: solved there, never taken over at boot'
status: done
assignee: []
created_date: '2026-11-03T14:13:00Z'
updated_date: '2026-11-03T14:26:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1911 (2026-11-03 16:11, dima, in the side channel): do we have support for side-thread pocket tickets — the tickets i want to solve with the side thread? ❓
today: `pocket-add --side` only marks the birth, and main's boot takes the item over (script/pocket-add.ts:60, FRM-464). side's pick: an owner field `--side` sets, honoured by the boot and pocket-check; new surface → clio:shape-idea and ⚖️ worth it first. ties to the 12:27 fold candidate «a side channel shapes and builds its own asks». first real case: pk-310 (the Finder restart after the halt).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
* W1914 (2026-11-03 16:15, dima): we need another feature for pocket, possibly a label for pocket items that marks a ticket as a side channel pocket ticket.
* W1915 (2026-11-03 16:15, dima): some stuff that i plan and want to solve with a side channel, not with you, to balance the load properly — some stuff is better solved inside the channel.
* W1916 (2026-11-03 16:15, dima): pocket, not linear for now. propose how to have it; it's reasonably simple, so let's quickly shape the idea and have it right now.

W1917 (2026-11-03 16:18, dima): "side-owned" — maybe «side-channel» or «side-channel—owned»? ❓
W1918 (2026-11-03 16:18, dima): «side-owned» can mean side lane too.

close: built 2026-11-03 16:28 (389c6184): label side-channel-owned, pocket-add --side-channel-owned, boot keeps it out, side-channel lists and closes it; dima's o88–o90. pocket-add's label join tested only by reading, its first live use proves it

close: W1911 done (the label is the support he asked about), W1914 done (label side-channel-owned), W1915 done (a side channel lists and solves them), W1916 done (pocket only, built same day), W1917–W1918 done (the name moved off «side-owned» to side-channel-owned, o88). raw drops: ~/.local/state/clio/grooms/2026-11-03-1611.raw.md, -1615.raw.md, -1618.raw.md
<!-- SECTION:NOTES:END -->
