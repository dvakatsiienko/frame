---
id: PK-196
title: >-
  output format switch: mobile mode via a skill and back to orbit; cowork always
  in waiting-for-your-word blocks — no stray memory copies
status: done
assignee: []
created_date: '2026-10-19 12:17'
updated_date: '2026-10-20 12:41'
due_date: '2026-10-21'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 1100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-19 (wish + his ask), folded: before orbit we talked through a «waiting for your word» block he pasted back with steers; since orbit that model moved into the mobile-mode skill, because mods do not run on mobile. problems: (1) mobile mode is untested and feels unreliable — mod and orbit habits sit scattered across memory; it must work two ways: enabled from a phone → full text mode, no mods; back at the desktop keyboard → back to mods, the skill undone. (2) cowork threads have no mods either: they should always reply in waiting-for-your-word block mode, not full mobile mode, and the skill content should apply to cw's memory-only reply format. also «solve cw pbcopy block». his ask: how to solve this output format switch gracefully, efficiently for everyone, without stray memory duplication — we just finished a memory sweep and what he wants least is memory collating stray instructions again. full text: inbox-composer.md W2
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
restored from the raw: stop using mods like orbit and phases — he does not see them and does not rely on them — and fall back to previews.

18:40, dima o67 (17:17): «let's do both after big tickets are done» — this grill waits for the big tickets (FRM-219, FRM-270).

2026-10-20 inbox (PK-209, folded here), dima: «yesterday you fixed the waiting-for-your-word block, so it should ride the cw memory sync; does it already work? can i run the sync → pbcopy → paste into claude.ai → account → profile, and cw receives it?» answer 14:55: not yet — no rule line holds the block (grep over rules/ and CLAUDE.md: none); the pipe itself exists (pnpm memory-sync:copy → clipboard → claude.ai profile). lands with this item's build.

2026-10-20 14:52 correction: the note above is stamped 14:55 but was written 14:51; and its fold dropped his want — cw threads have no orbit, so they should print that block in their replies.

2026-10-20 15:03 dima: undo the «after the big tickets» park — pull it close and solve it now, it is freebie-sized. moved to now, top.

2026-10-20 15:45 checked first (dima o15): nothing landed 10-18..19 (git log over the format, mods, mobile-mode and cw plugin files). cc side was solved 10-13 by x-mod-stash 52408b84 — one no-board reminder for mobile mode and orbit off prints the ⏳ fence. the gap was cw only: rules/fleet-output-format.md's orbit-off questionnaire line reworded in place to «no board in reach (cw always; cc with orbit off or mobile mode) → the asks fence» — no new line, no copy. cw receives it at the next memory-sync:copy paste.
<!-- SECTION:NOTES:END -->
