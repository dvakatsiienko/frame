---
id: PK-148
title: 'x-mod-guard: nudge cclio toward helper-lite at the 3rd image Read in one turn'
status: done
assignee: []
created_date: '2026-10-15 17:10'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it opens after the memory sweep
dima, 2026-10-15: a mod-guard item that suggests to you to use helper-lite to read images is a good idea. today cclio read 6 Sill screenshots by hand against the 5+ rule. the nudge is model-side only (a hook line in cclio's context, no visual for dima), on a Read of an image file, the 3rd in one turn; it names helper-lite and fleet-tooling.md. owner: the mods lane (PK-120).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 halt flush (a repeat: 2 skipped delegations in a day): widen it — also nudge cclio at a find-and-replace (sd, a script) across 10+ paths, pointing to composer's bulk-replace

10-19, dima asked whether agent.spawn could nudge coders toward subagents (scout, helper, helper-lite): no — agent.spawn fires only on a spawn that already happens (it can deny; since 2.1.300 rewrite only a workflow agent's prompt/model). the nudge door is tool.call: a context hint on the Nth Read/Grep/image in a turn, the way x-mod-guard hints land today. widen this item from images to coder reads → scout/helper-lite.

ticket: FRM-428
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-428 carries this item (its body lists «pocket PK-148») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
