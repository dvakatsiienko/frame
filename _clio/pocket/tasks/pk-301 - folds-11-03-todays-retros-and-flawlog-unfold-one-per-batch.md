---
id: PK-301
title: 'folds 11-03: today''s retros and flawlog, unfold one per batch'
status: open
assignee: []
created_date: '2026-11-02T20:27:00Z'
updated_date: '2026-11-03T09:37:00Z'
labels:
  - m
dependencies: []
priority: next
type: task
ordinal: 20000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
folds for 2026-11-03 — unfold ONE per batch, after the mods lane is running (dima 22:25: «let's unfold gradually, do not throw it all at once on me»). each fold: where it came from, the evidence, the move, its size.

F1 · mods-verify gets the lane's 14 verify-recipe gaps (size: s, clio alone)
- from: the 12 mods lane 4 retros, `~/.local/state/x/lanes/mods-lane-4/2026-11-02-*-retro.md` (477, 478, 479, 486, 487, 488, riders); kept untrashed until this fold lands
- sample line: «A revert proof mutates behaviour, never deletes a module»
- move: each gap becomes one line in the `mods-verify` skill (project `.claude/skills/mods-verify/SKILL.md`), merged with what it already says; then the retros are trashed
- done: every one of the 14 is placed or dropped with a reason

F2 · 12 automation candidates + 7 tooling bugs from the same retros, worth-checked (size: m, with dima, one ask round)
- 11 of 12 carry a pain line; #6 `mods:cap-fixtures` has none of its own
- the list: `mods:store-keys`, `mods:probe-rows`, `mods:probe-live`, a refusals() chain test, `reply-check:replay`, `mods:cap-fixtures`, an x-mod-guard rule for `_clio/` paths, a `mods:live` cap replay, biome in `x mods edit test`, a wall-clock-free timer harness (FRM-470), `x mods edit push <paths…>`, red-proof refusing a red baseline
- the 7 bugs: a red overlay blocks `x mods edit push` (~90 s rerun per flake), a hook printed `_clio/AGENTS.md` into codie's context, and the rest in the 478/479/488 retros
- move: each gets ⚖️ worth it (root invariant 3) — what it removes vs today's door — then a ticket line, a merge into a signed chunk, or a no. today's retro lesson applies: a count is not pain

F3 · the quiet queue held codie's push requests (size: s, a mods wisp to shape)
- from: 5 comms lines in the retros («clio unreachable at final», twice «did not accept it») + codie's 3 «please push» pings tonight, all held as [progress] in x-mod-stash's quiet comms
- crow 22:03: «a push held as a slipstream is the silent loss dima named on 10-12»
- move: shape a mods chunk — a ping asking clio to act (push, [ask], next:) is never held; sign it into mods lane 4 or the next

F4 · the reply check missed an empty last message (size: xs, find why)
- from: 22:02 — clio answered «what is the references skill?» in text before a tool call; the last message held only the 🔭 line. crow caught it 22:03; the next prompt's ↩️ caught a second one at 22:25
- move: read why the reply-check's «text before a tool call» catch fired only after the fact, not at Stop; fix or ticket

F5 · desktop-thread summons bypass `x brief summon` (size: xs, into the cli pick)
- from: flawlog 12:58 — `x brief summon` only reads a `claude --bg` argv; a desktop-thread summon (start_session) has no check
- move: one line in the cli pick, or a rider on FRM-480

F6 · the retro card's wording fix, census + drift check (size: xs, dima o88)
- `script/x-cli-census.ts:49` prints «raw Bash heads no x door covers»; `.claude/skills/cli-drift-check/SKILL.md:41` calls a ≥5-run head a «gap»
- move: a gap needs a pain line (a flawlog or retro hit, a catch of dima's) and no script of ours on it; «automates the most» → «removes the most counted pain». run before the cli drift check

F7 · the red cli-purpose checkup line files pocket items (size: xs, retro finding 4)
- from: `_clio/checkup/log.md:31` (11-01) flagged 9 verbs at 0 calls and nobody owned it
- move: a red cli-purpose line writes one pocket item per 0-call verb through `pocket-add`, in `clio:system-checkup`

F8 · cuts and closes waiting
- `x fleet audit`: cut (dima W1435 «if not works cut»; tonight it found 0 codies over 3 days — it only sees `/x:crew-codie`-opened sessions, never a desktop thread). rides the next cli lane
- FRM-479: wired into x-mod-guard, never fired; o94 asks to close as a rare event
- PK-288 and PK-291 were closed by helga with every W-line cited done, unread by clio: re-read both against their homes
- the cut list's 9 unclear parts (`.scratch/worth-test/cut-list.md` § 3), after Rockstar (dima o56, o76)

retro batch 2026-11-03 (clio): 338 sessions, 14 days, opus 5.5 on the batch api, ~$54 of the gifted $100; 2,622 findings in ~/frame/.scratch/retro-batch/findings-2026-11-03.json, themes + fixes in ~/frame/.scratch/retro-batch/themes-2026-11-03.md — folds read the themes file first
<!-- SECTION:NOTES:END -->
