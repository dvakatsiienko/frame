---
id: PK-382
title: >-
  chatter prompt box: a join tick (slipstream), a held send pushes, a hotkey
  pair, top-7 names for join and send
status: open
assignee: []
created_date: '2026-11-12T11:37:00Z'
updated_date: '2026-11-12T11:41:00Z'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 52000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-382:W1 (2026-11-12 inbox, dima): chatter prompt box: a «join» tick button for this text box only (slipstream); it is a part of the nested chatter box.

PK-382:W2 (2026-11-12 inbox, dima): it reaches you mid-turn or at turn start once «join» is ticked; the tick clears on message attach, once it joined your turn.

PK-382:W3 (2026-11-12 inbox, dima): make the indicator states pretty: while a ticked message is pending, the button has a distinguishable ui.

PK-382:W4 (2026-11-12 inbox, dima): when a ticked message is attached, show it: for example, it turns into a «flied» state and keeps it for ~3 s. or propose a prettier way to show that the message «joined» and reached you.

PK-382:W5 (2026-11-12 inbox, dima): «send» becomes special: by default, a click enables «join mode».

PK-382:W6 (2026-11-12 inbox, dima): it sends the message (push) when the LMB is held for 5 s, with a progress indicator: holding the LMB over «send» shows those 5 s as filling progress. high perf and responsiveness are required.

PK-382:W7 (2026-11-12 inbox, dima): this is only an idea, and it may not work, or work clunky. then we think of another way, or propose a better UX before we test this mvp.

PK-382:W8 (2026-11-12 inbox, dima): hotkey: propose a neat hotkey. pressed once, the text in the chatter box is marked as ready to join your next turn or mid-turn.

PK-382:W9 (2026-11-12 inbox, dima): held (long), the hotkey sends (push). threshold to be defined: start with 200 ms and propose a better value. what's the modern ux baseline? ❓

PK-382:W10 (2026-11-12 inbox, dima): propose a top-7 name (rethink the split function): a cool name for «join» mode, and a cool name for «send» mode.

PK-382:W11 (2026-11-12 inbox, dima): the rethink may widen to orbit too: all orbit asks are «joiners» too, but they're all named «tick», which is not too bad but blurry. what would be a cool name for such buttons everywhere, one that says what they do best, sounds cool, and is easy to spell and type? ❓
<!-- SECTION:NOTES:END -->
