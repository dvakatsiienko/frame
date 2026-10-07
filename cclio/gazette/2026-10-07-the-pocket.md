---
date: 2026-10-07
slug: the-pocket
tickets: [FRM-303, FRM-336, FRM-284, FRM-267]
posted: {health: no}
---

# 🗞️ cclio's gazette · the pocket

## shipped

- 🫙 **flowlog became the pocket**: `cclio/pocket.md`, one file shaped after matt's local tracker (order · decisions so far · standing · 18 items), checked and emptied before linear; shaped through `x:shape-idea` with a two-round grill and the blind plan critic ([FRM-336](https://linear.app/x-com/issue/FRM-336), 5 findings, all folded). the old vault journal is archived, the jev inbox lane is now `pocket`, every live layer renamed (cclio 0.3.106)
- 🪧 **skill arg hints**: `cclio:boot`, `cclio:checkpoint`, `cclio:shift` carry `argument-hint`; a fresh session shows them
- 🐦‍⬛ **ccrow on the halt roster**: its stop was buried in phase 5 and the 10-06 halt skipped it; phase 0 now names it
- 🎧 x-speak releases the audio engine when the output device changes; `crew-cloud` handles a cloud report in place (from `cclio_`, x 0.11.220)
- 🗑️ research `plan-adviser.md` + `design-review-comms.md` retired, their tickets done

## tricks gained

- a plugin bump does not reach a running desktop session even after `/reload-plugins`; the skill base dir still names the old version
- the stash asks box can show a dead session's asks under a live name (pocket 17, [FRM-303](https://linear.app/x-com/issue/FRM-303))
- matt's `to-spec` / `to-tickets` are typed-only; `chief-of-staff` sits in his in-progress shelf (pocket 01)

## state

- pocket order: 01 chief-of-staff → 02 phone mirror → 18 queue fold → 07 tool-call retro → … → 09 cli plan ([FRM-284](https://linear.app/x-com/issue/FRM-284)) → 10 sweep plan ([FRM-267](https://linear.app/x-com/issue/FRM-267))
- no coders · ccrow stopped

⸻ upd 15:40 (checkpoint)

**shipped**
- spec flow: the linear body is a spec seed, the boundary is in time (linear until dispatch, the spec owns the run); user-only matt skills run by reading their SKILL.md; [claude-code#100193](https://github.com/anthropics/claude-code/issues/100193) asks for slash commands in SendMessage
- x: a verb is done when its old door is dead; one resident line instead of a per-verb index; `x lane push` is the only door to main (guard)
- stash: dead sessions' asks hidden; every prompt carries `now HH:MM`
- guard: obsidian `--help` / target-less delete refused, refusals say «nothing ran», a delegate hint at cclio's 8th code edit
- pocket: x-queue folded in, a read-only phone mirror with an icon, decisions at the end emptied into this post, a test drive to 10-21
- agent-ops: 3 research lanes say chain length is the wrong target; `pnpm agent-ops:report` (cost per ticket median 30M tokens / 30 min, boot full 1.8M / 61 s), recipe + shelf file
- tooling: gopls + staticcheck from brew, renovate gomodTidy; renovate merged motion 14 ([bytes#123](https://github.com/dvakatsiienko/bytes/pull/123)) and the mcp sdk security fix ([frame#62](https://github.com/dvakatsiienko/frame/pull/62)); bytes back on main
- retro: first in-thread run; coders and verifiers self-retro, never a retro session

**tricks gained**
- `mcp__ccd_session_mgmt__get_usage` reads plan limits + context in a desktop session with no sline feed
- a prompt runs one slash command, the rest is its args; `obsidian <verb> --help` runs the verb on the active note

**state**: next is the cli plan (pocket 09) then the sweep plan (10), in the slimmed thread after `/compact`; no coders; ccrow paused for the checkpoint

⸻ upd 17:55

**shipped**
- cli plan: [FRM-284](https://linear.app/x-com/issue/FRM-284) closed (go + charm won, v1.1 shipped); five grill rounds wrote «the next lane» into `x/PRODUCT.md` — telemetry first, then handoff, linear, the stats board; four specs in `.scratch/` under [FRM-14](https://linear.app/x-com/issue/FRM-14), ccrow split telemetry from the board so the foundation ships alone
- the linear family came from data: 981 raw `linear api` calls in 30 days, classified by operation → eight verbs, `x as` identity, a traced raw door
- `docs/knowledge/charm.md`: the stack page, widget per view, v2 traps, three doc doors (a source lane + exa + parallel); sequin and duckdb in the `Brewfile`
- the `researcher` agent: `omitClaudeMd`, first request 9.2k tokens against ~137k for a plain agent; a 19-call research took 33.6k
- duckdb on a test drive: the 981-call classification in 0.26 s, against a helper's 115 s / 166k tokens
- memory sweep plan ([FRM-267](https://linear.app/x-com/issue/FRM-267)): three grill rounds, a spec + nine phase tickets in `.scratch/memory-sweep/`, delete-first, four memory tiers, the log in `docs/test-drive/memory-sweep.md`

**tricks gained**
- a typed prompt expands one slash skill, the first; a second on the same line or the next is text (2.1.292), though the skills docs say six stack; the model still composes skills through the `Skill` tool
- block html comments in `CLAUDE.md` cost zero tokens — cross-refs move there
- a new agent file reaches a running session after a short delay

**state**: checkpoint 2; the sweep starts in this thread after the compact (ticket 01, then 03 recipes); the telemetry coder spawns with it; ccrow paused

⸻ upd 20:43 (checkpoint 3)

**shipped**
- cli lane: [FRM-340](https://linear.app/x-com/issue/FRM-340) x telemetry (frame#63) and [FRM-343](https://linear.app/x-com/issue/FRM-343) x handoff (frame#64) merged, each after a verifier loop; [FRM-344](https://linear.app/x-com/issue/FRM-344) x linear is building (frame#65, 10 tickets, the first to-tickets cut)
- recipes became a feature: `~/frame/recipes/<name>/`, the `x:shape-recipe` engine with shared research + analysis vectors, a shape test in the commit hook, nurture-memory 53.6 → 25.1 KB with its groom card
- sweep phases 01–02: the baseline (fresh terminal boot 153k, the Code tab ~33k heavier), two prompt audits, the research on self-managed memory; the doctor slice fixed 13 stale facts and contradictions
- fleet: the opus-register hook deleted; to-tickets for every spec; a step-0 «brief against the world» line in every crew skill; ccrow notes carry their vet id

**tricks gained**
- `/skill-doctor` moved into the plugin manager's Stats tab; `/doctor prompt-audit` runs only in a terminal claude
- block html comments are stripped in imported leaves and `rules/` files too
- `red-proof` needed `-count=1` for go and a touch on restore, or a cached build hides the mutation

**state**: checkpoint 3; next is the recipe review and run, `refresh-craft-spawning` first; FRM-344 coder + verifier live; ccrow paused

## trail

- shipped: x telemetry + x handoff merged · recipes as a feature (x:shape-recipe, recipes/, shape test) · sweep 01–02 + the doctor slice · opus-register hook gone · to-tickets for every spec
- open: the recipe runs (craft-spawning → nurture-memory → nurture-skills) · FRM-344 x linear · sweep phases 04–09 · the raycast run for x handoff (dima)
- state: frame pushed · FRM-344 coder + verifier live · ccrow paused · weekly 62 %, 5h 74 %
