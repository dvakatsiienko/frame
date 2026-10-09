---
id: PK-21
title: '[59] a live autocompact threshold input in the stash pane'
status: open
assignee: []
created_date: '2026-10-09 10:38'
labels: []
dependencies: []
priority: next
type: grill
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 59 · status line was: open · idea · grill first, no build before the grill

- dima, 2026-10-08: «something like a number input that i can edit live — a compaction threshold». context: cclio's `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` in `cclio/.claude/settings.json` takes effect live (a 45 % probe compacted cclio one turn later, 20:43); set to 70 at 21:25
- shows: context % against the threshold; a compaction fired → when, from what % to what %
- open: does a stash band write settings.json (a shared, hand-kept file), or a stash-owned env file? per session or cclio-only?
- grill 10-09, Q7 accepted by silence: it writes the current session's project `.claude/settings.local.json`, never user settings
<!-- SECTION:DESCRIPTION:END -->
