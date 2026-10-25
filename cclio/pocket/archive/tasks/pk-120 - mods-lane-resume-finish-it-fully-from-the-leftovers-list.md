---
id: PK-120
title: 'mods lane resume: finish it fully from the leftovers list'
status: done
assignee: []
created_date: '2026-10-13 17:06'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
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

10-19, from the scout shaping (dima o24: «I'd spawn a coder for a lane and do this measure before the lane»): the next mods or cli coder lane carries the scout race — Haiku 5.5 vs Sonnet 5.5 on 5 real coder lookups at a frozen commit, recall within the 40-line cap, tokens per call — and the pass line (net tokens of scout plus caller, verifier rounds, Read chars per edited line vs the baseline in cclio/.scratch/shape-scout/coder-lookups.md + read-ceiling.md), measured right before the lane starts. no coder is spawned just for it.

2026-10-19 rider: the tdd trial rides this lane (dima o96) — the coder brief loads mattpocock-skills:tdd and the done report logs a line in docs/test-drive/tdd.md § next lanes

2026-10-21 evergreen riders (dima: «if something else worth adopting — add to the mods lane rider»), from .scratch/evergreen-borrows/source-lane.md: (1) orbit note/steer fields take Input rows={2} (cc 2.1.301; x-mod-stash register.tsx ~4835, 5008, 4679, 5355, 5458) + a desktop probe — undoes the multi-line half of workarounds «orbit's note»; (2) $.ui.view({ agentId }) — a 👁 button on board lane rows opens that agent's transcript; (3) virtualText — ghost «🪐 n asks» into the prompt box; (4) the OTel cache_creation_5m/1h split — prove the 🔥 keep-hot ping keeps the cache warm; (5) decider: "person" as a replacement for guard's # dima-ok proof — dima's call, it means a dialog. skipped: e.isReadOnly (guard computes written paths on tool.call, nothing to delete).

2026-10-21 15:35 rider (6), dima's word 11:35: «I saw you proposed e.isReadOnly. let's try borrow». try it: a tool.check hook in x-mod-guard reading e.isReadOnly (cc 2.1.304). cclio's one-line objection: guard decides on the paths a command writes (writtenPaths, rules/overwrite.ts:45), the flag gives no paths, so it may delete nothing — the try settles it.

2026-10-21 16:11 the evergreen source lane moved: docs/research/evergreen-borrows-2026-10-21.md.

rider 2026-10-23: FRM-417 (x-mod-guard: milestone-less linear create/move refused) — in the 🐋 mods lane 1 landed milestone, shaped by cclio:shape-lane, exit lines sealed before the lane spawns (dima 12:55).

2026-10-23 14:55 cclio: dima's want for this lane, moved from FRM-304's body (cleared, standing): «we have more ideas for mods … let's exhaust the full list, until there's nothing else useful to do with mods» — 14:46: it means solving all existing mods tickets, not a recipe. FRM-304's other lines: the afk digest was cclio's idea (dropped), the own-agents.md ask is done (mods/AGENTS.md); the old body sits in ~/.local/state/cclio/standing-bodies-2026-10-23.md

2026-10-23 18:28 rider from the lane-init build (PK-263): x-mod-guard's spec rule still cites «cclio:shape-lane § 2.5» and fires only on 3+ items — `hooks/rules/spec.ts:1,10`, `tests/spec.test.ts:7,10`, `FTR.md:234`; it now points at `cclio:shape-lane-dispatch` § 2 and covers every lane with a member (dima's Q6: a spec on every lane).

2026-10-23 21:03 mods wisp: x-mod-guard's «held the foreground N s last time» hint misleads — it said backlog task edit held 79–130 s, a timed probe measured 0.16 s for an append-notes; the hint likely times the whole tool call, not the command. fix the measure or drop the hint

## W-lines (groomed from the raw notes above; raw notes kept)
W1 (o14, 15:49, date not in note): rider for the second-wind mod: after every compaction the mod submits /reload-skills itself (cc changelog: «re-sends the full skill list, which is how to get skills back after compaction»).
W2 (o19, 16:09): riders: probe a Button wrapping an Svg (engine.md:7); every mods coder brief names x:art-kit.
W3 (o31, 16:31): the second-wind op takes a required pending: field; only none lets it compact.
W4 (o31, 16:31): his steer for the mod's note text (WIND_NOTE + WIND_NOTE_OWNER): «a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.»
W5 (2026-10-15, dima's screenshot, ✨ wisp): the board's sessions card shows a thread whose cache went cold (composer idle 1h32m) with ⚠️; it should show ❄️.
W6 (2026-10-18, dima, no o-id): refresh and reorganize the scope so the lane is in good shape whenever it resumes (a lane is not decided); the whole scope, re-sorted P0–P6, lives in ~/frame/.scratch/mods-lane/scope-2026-10-18.md.
W7 (2026-10-19, o24, «I'd spawn a coder for a lane and do this measure before the lane»): the next mods or cli coder lane carries the scout race, Haiku 5.5 vs Sonnet 5.5 on 5 real coder lookups at a frozen commit (recall within the 40-line cap, tokens per call); the pass line is net tokens of scout plus caller, verifier rounds, Read chars per edited line vs the baseline; measured right before the lane starts; no coder is spawned just for it.
W8 (2026-10-19, o96): the tdd trial rides this lane: the coder brief loads mattpocock-skills:tdd and the done report logs a line in docs/test-drive/tdd.md § next lanes.
W9 (2026-10-21, dima: «if something else worth adopting — add to the mods lane rider», from .scratch/evergreen-borrows/source-lane.md): (1) orbit note/steer fields take Input rows={2} (cc 2.1.301) + a desktop probe; (2) $.ui.view({ agentId }): a 👁 button on board lane rows opens that agent's transcript; (3) virtualText: ghost «🪐 n asks» in the prompt box; (4) the OTel cache_creation_5m/1h split: prove the 🔥 keep-hot ping keeps the cache warm; (5) decider "person" as a replacement for guard's # dima-ok proof (dima's call; it means a dialog). skipped: e.isReadOnly, see W10.
W10 (2026-10-21 15:35, dima's word 11:35: «I saw you proposed e.isReadOnly. let's try borrow»): try it: a tool.check hook in x-mod-guard reading e.isReadOnly (cc 2.1.304). cclio's objection kept: guard decides on the paths a command writes (writtenPaths, rules/overwrite.ts:45), the flag gives no paths, so it may delete nothing; the try settles it.
W11 (2026-10-23 14:46, dima's want, moved from FRM-304's body): «we have more ideas for mods … let's exhaust the full list, until there's nothing else useful to do with mods»; it means solving all existing mods tickets, not a recipe.
W12 (2026-10-23, dima 12:55): FRM-417 (x-mod-guard: milestone-less linear create/move refused) rides the 🐋 mods lane 1 milestone, shaped by cclio:shape-lane, exit lines sealed before the lane spawns.
W13 (2026-10-23 18:28, cclio's rider from the PK-263 lane-init build; dima's Q6: a spec on every lane, no o-id): x-mod-guard's spec rule still cites «cclio:shape-lane § 2.5» and fires only on 3+ items (hooks/rules/spec.ts:1,10; tests/spec.test.ts:7,10; FTR.md:234); point it at cclio:shape-lane-dispatch § 2 and cover every lane with a member.
W14 (2026-10-23 21:03, found by cclio, not dima's word): x-mod-guard's «held the foreground N s last time» hint misleads: it claimed backlog task edit held 79–130 s, a timed probe measured 0.16 s for an append-notes; fix the measure or drop the hint.
W15 (2026-10-16 14:46, found by cclio from an upstream read, changedetector claude-code#91870, not dima's word): (1) a hook on an event an older engine does not know refuses the whole module (prompt.change, new in 2.1.300): check mods against session version skew; (2) one bad pane node refuses the whole pane: sanitize trees, try/catch renders; (3) delivery latency: inbox socket 0.11 s, channels 2.45 s, $.prompt.submit 14.4 s; a reload loses a pending submit and a pending clock.after; (4) the non-deferred mod tool description limit is 4096 chars on 2.1.296–2.1.301; cc 2.1.301 adds Input rows (maybe PK-149's steer box) and $.model.fork fixed before the first response.
W16 (dima 20:05, date not in note, cclio's paraphrase, no quote): parked; the mods lane resumes at a good point to finish fully; the old leftovers list (~/frame/.scratch/mods-l13/leftovers-2026-10-13.md) is closed, the scope now lives in scope-2026-10-18.md.
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today

close: W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 W16 moved to FRM-304 — folded under «from the pocket» (5 of 16 W-lines copied, the rest already in a ticket) (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
