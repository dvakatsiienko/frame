---
id: PK-424
title: herdr tabs merged into antenna (I2)
status: open
assignee: []
created_date: '2026-11-15T12:27:00Z'
updated_date: '2026-11-15T14:17:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 69000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-424:W1 (2026-11-15 inbox, dima): merge the tabs into antenna. tabs share similar functionality with the agents list in herdr. when i select a thread in the agents list, it gets highlighted, and so do the tabs. both use drag and drop.

PK-424:W2 (2026-11-15 inbox, dima): scrolling in tabs goes wild and does not work well. i think it is because of herdr.

raw drop (2026-11-15 inbox, dima): ⏳ herdr tabs: tabs share similar functionality with the agents list in herder. i want to merge them together into antenna. when i select the thread in the agents list, it gets highlighted as well as the tabs. both use drag and drop.  scrolling in tabs goes wild and doesn't work well. i think it's because of herdt.

PK-424:W3 (2026-11-15 14:52, dima): the current problem: tabs on top duplicate the agents list, which is not good.

PK-424:W4 (2026-11-15 14:52, dima): i want to keep the ability to have a terminal (a special tab), but not keep the whole tabs section just for it, since i use the terminal rarely. i start you via clio -Herdr, right from herdr, via command+tab, command+T.

PK-424:W5 (2026-11-15 14:52, dima): can the terminal live in antenna, a pane section on the left side of the app, where antenna stores lists of agents (each agent a row; clicking it opens its thread)? ❓

PK-424:W6 (2026-11-15 14:52, dima): switch between agent rows in antenna via command+1, command+2, command+3, and so on.

PK-424:W7 (2026-11-15 14:52, dima): command+T creates a terminal tab in antenna. can it work like this? ❓

note (helga): source ~/.local/state/clio/prompts/2026-11-15.md:84 (14:52 block); no 14:52 groom file in grooms/. only dima's own lines taken; clio's replies in the same paste skipped.

PK-424:W8 (2026-11-15 15:46, dima): ctrl+J works; the stashed tray terminal may beat a dedicated tab for my one-off use; i'll test it soon and decide tab or tray.
<!-- SECTION:NOTES:END -->
