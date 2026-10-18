---
id: PK-120
title: 'mods lane resume: finish it fully from the leftovers list'
status: waiting
assignee: []
created_date: '2026-10-13 17:06'
updated_date: '2026-10-18 16:01'
due_date: '2026-10-24'
labels:
  - m
dependencies: []
priority: later
type: task
ordinal: 100500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the memory sweep (FRM-267) to close — it runs right after.
parked: dima 20:05, tomorrow opens on the memory sweep; the mods lane resumes at a good point to finish fully. the list: ~/frame/.scratch/mods-l13/leftovers-2026-10-13.md (open todos, looks dima never saw, engine gaps, half-true docs), with ~/frame/.scratch/mods-l13/todo.md
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
rider for the mods lane resume (dima o14, 15:49): a probe in the second wind mod — after every compaction the mod submits /reload-skills itself (cc changelog: «re-sends the full skill list, which is how to get skills back after compaction»).

riders (dima o19, 16:09): probe a Button wrapping an Svg (desktop draws Svg as a non-clickable image, engine.md:7); every mods coder brief names x:art-kit for finer drawings.

rider (dima o31, 16:31): the second-wind op takes a required pending: field, only none lets it compact. his steer for the mod's note text (WIND_NOTE + WIND_NOTE_OWNER): a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.

✨ wisp, dima 2026-10-15 (screenshot): the board's sessions card shows a thread whose cache went cold (composer idle 1h32m) with a ⚠️ — it should show ❄️.

2026-10-16 14:46 upstream read (changedetector, claude-code#91870, a 3-mod production report, 2 weeks): (1) a hook on an event an older engine does not know refuses the WHOLE module (prompt.change, new in 2.1.300, blanked mods on 2.1.296/299) — check our mods against session version skew; (2) one bad pane node refuses the whole pane — sanitize trees, try/catch renders; (3) delivery latency in a busy session: inbox socket 0.11 s (next tool boundary), channels 2.45 s, $.prompt.submit 14.4 s (waits for turn end); a reload loses a pending submit and a pending clock.after; (4) the non-deferred mod tool description limit is 4096 chars on 2.1.296–2.1.301. also cc 2.1.301 (we run 2.1.299): mod Input gets `rows` (multi-line, Shift+Enter) — maybe PK-149's steer box; $.model.fork fixed before the first response.

2026-10-18, dima: refresh and reorganize the scope so the lane is in good shape whenever it resumes (a lane is not decided). the whole scope, re-sorted P0–P6, now lives in ~/frame/.scratch/mods-lane/scope-2026-10-18.md and replaces reading the mods-l13 leftovers + todo (all todos closed there).
<!-- SECTION:NOTES:END -->
