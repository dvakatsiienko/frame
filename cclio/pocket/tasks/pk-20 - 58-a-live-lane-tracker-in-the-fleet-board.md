---
id: PK-20
title: '[58] a live lane tracker in the fleet board'
status: open
assignee: []
created_date: '2026-10-09 10:38'
labels: []
dependencies: []
priority: now
type: idea
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 58 · status line was: open · idea · shape-idea first

- dima, 2026-10-08 (screenshot, the board's empty lower half): «i often ask you to tell me where we are … how could i see that plan live via a mod, maybe in the board area, because it has a lot of wasted space?»
- what it shows: now · next · then — the thread's lane (researching the adviser → cli groom → night-shift grill), one line each, plus the 🔭 waits
- two sources, a grill picks one: the pocket's «order» plus a `now:` line cclio keeps · or a `📍 now:` line in cclio's replies, which x-mod-stash already parses (it reads the ⏳ block today), so no new file
- owner: x-mod-stash's board (the mods coder); FRM-349 kept the board in stash, so this is its home
- dima, 2026-10-09 (screenshot, the board's empty lower half): «what I wanted is a live list of a lane with checkboxes (ordered tasks, organized by lane if several lanes run at once), so I could see a kind of progress live.» the `📍 now:` reply line was «naive, it will display poorly». a file the mod reads from has to exist, but never a stray one: it serves several purposes at once — cclio's live progress log during a lane (the one planned before) and the board's render. «a bigger thing to plan» → a granular grill tomorrow, then a ticket
<!-- SECTION:DESCRIPTION:END -->
