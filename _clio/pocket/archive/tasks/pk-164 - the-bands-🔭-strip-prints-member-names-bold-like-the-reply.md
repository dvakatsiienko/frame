---
id: PK-164
title: "the band's \U0001F52D strip prints member names bold, like the reply"
status: done
assignee: []
created_date: '2026-10-16 14:17'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: wish
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).

dima, 2026-10-16: «when you wait for any subagent, always print the real subagent name … with the name and the emoji. the name should be bold everywhere, including my mod strip above the text box prompt.»

why: x-mod-stash `hooks/parse.ts` `parseWait` runs `plain()` over the 🔭 line, so `**🐜 helper**` reaches the band as plain text; `backgroundWait` badges a subagent but renders no bold.
done when: a 🔭 line with a bold member name shows bold in the band, red-proven.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-426
re-dated 2026-10-25 from 2026-10-23: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: moved — FRM-426 carries this item (its body lists «pocket PK-164») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
