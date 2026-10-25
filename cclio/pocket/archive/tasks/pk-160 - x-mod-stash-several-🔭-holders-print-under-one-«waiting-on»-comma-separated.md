---
id: PK-160
title: "x-mod-stash: several \U0001F52D holders print under one «waiting on», comma-separated"
status: done
assignee: []
created_date: '2026-10-16 11:11'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).
dima, 2026-10-16 (screenshot of the band): the band repeated «waiting on» per holder; he wants one «waiting on» and the holders split by commas — «waiting on wishkeeper, researcher, dima» — done in the mod, mechanically, not as a memory rule. touches parse.ts parseWait (joins the 🔭 lines with '; ' today) and register.tsx's bold rendering (lines ~3088, ~5605–5640 split on '; ' and match a per-part «waiting on»), plus band.test.ts 'the 🔭 line prints who it waits on in bold'. a scratch try on 10-16 went red on that test and was not pushed. done: the band shows one «waiting on», commas, each holder still bold; the interim line in rules/fleet-output-format.md goes.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: a half-done parse half of this merge sits in the x mods edit scratch (written 10-16 by cclio), byte copy in the mods coder's scratchpad — the starting point when P4 takes PK-160.

ticket: FRM-426
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-426 carries this item (its body lists «pocket PK-160») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
