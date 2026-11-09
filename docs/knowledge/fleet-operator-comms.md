---
fed-by: recipe refresh-fleet-operator-comms
when:
  - { kind: basename, value: fleet-output-format.md }
  - { kind: basename, value: fleet-voice.md }
  - { kind: basename, value: habit-dima-comms.md }
  - { kind: basename, value: output-crew.md }
---

# comms — the ledger of dima ↔ fleet talk

## core

what the 10-10 ledger measured (37 days, 2,512 prompts), the numbers a comms change must move:
- 42 % of his prompts show a gap: «what can the system do» 17 %, «did it land» 9 %, then a lost decision, unreadable output, «is it stuck»
- re-asks ~8 % (~200); pushback ~27 % with context
- he still asked for status 98 times across 322 replies that carried a 🔭
- 58 of 136 ask fences came back pasted unchanged → asks moved to orbit (10-10)
- replies grew 1,000 → 1,518 chars median over 3 weeks; a long reply goes with uncertainty
- 15 of 179 next prompts stop to decode a label

landed since: the reply budget, glosses, orbit asks, phases, glide, 🐠 catch, quiet comms (💨 slipstream). open: the decision log consulted before an ask (the re-ask fix), the labeller re-run against these numbers.

the rest: per-week trends, the labelling method and gold set, the research behind each lever.

kept by `recipes/refresh-fleet-operator-comms`; each run merges its numbers here and names the direction against the last run. the page view of the first run: [Operator Ledger](https://claude.ai/artifact/CJmBAGi8tJ9wyh8FW3kx9o).

## his prompts — 2026-09-03 → 2026-10-10 (37 days)

- 2,512 typed prompts, 104 sessions, 68 per active day, median 328 characters, 21 % with a screenshot
- kinds: steer 32 %, question 25 %, bare approval 20 %, wish 7 %, correction 5 % (8.2 % carry a correction flag)
- domains: fleet 27 %, tools 17 %, mods 10 %, git-ci 10 %, design 9 %, pm 8 %, research 7 %, apps 7 %, cli 3 %
- meta share (fleet, mods, pm, cli) by week: 50 → 43 → 21 → 37 → 38 → 86 %; apps fell to 0.3 % in W41
- correction rate is highest on apps (13 %) and the cli (12 %), lowest on git-ci (5 %)
- 57 re-asks; 204 prompts over 2,000 characters; 127 plugin reload or reinstall commands; peak hour 15:00 Kyiv

## the coordinator's replies — last 3 weeks

- 1,708 final replies; median 1,361 characters (p90 3,272), 19 lines, ~130k characters per active day
- by week: median 1,000 → 1,357 → 1,251 → 1,518; asks per reply 1.0 → 2.3; bullets 4 → 8
- 58 of 136 ask fences came back pasted whole and unchanged; 42 ignored; 36 steered
- 15 of 179 sampled next prompts stop to decode a label; commit hashes in 45 of 179

## with context (run 1 calibration, 305 stratified prompts, weighted back to the whole set)

- the first labels judged each prompt alone; with the turn before it, the picture moves:
  - the first pass counted corrections alone, one flag, no context: 8 %. with the turn before each prompt and the three published kinds, pushback is ~27 %: corrections 18 %, failure reports 6 %, rejections 2 % (gold set below)
  - re-asks with one turn of context: ~8 %, about 200 in 37 days, against 57 first counted; still an estimate, the decision-log match is not run yet
  - 42 % of prompts show a communication gap: «what can the system do or does» 17 %, «did it land» 9 %, then a lost decision, unreadable output, «is it stuck», a misread intent
- the context-free kind label agreed with the opus context label on 65 % of prompts; most flips were approvals, wishes and corrections that were really steers
- the gold set: the 93 prompts where opus and sonnet split, labelled by clio from their context; the 212 where they agreed count as settled (a known bias). against it: Opus 5.5 94 % pushback / 89 % gap, Sonnet 5.5 91 % / 89 %, Haiku 5.5 81 % / 68 %. Sonnet 5.5 clears the 85 % gate and stays the labeller; haiku is out; no model clears it on the 9-way kind, so kinds go to patterns where mechanical (approve, command, status). the set lives in the recipe's label store
- free numbers (duckdb, 3 weeks): 71 % of replies end with an ask fence; he answers those in a median 2.6 min (p90 11) against 1.3 min without; 1 fence in 5 gets an answer of another shape; 322 replies carried a 🔭 tracker and he still asked for status 98 times
- reply length vs a correction next: 8.5 → 6.1 → 8.1 → 9.7 % by length quartile, a weak link

## run 2 — 2026-11-09, the multi-wing picture (windows: 10-10→10-27 · side channels 10-28→11-05 · wings 11-06→)

- the queue: 2+ seats wait on him at once in 10 % → 23 % → 42 % (today) of his waiting minutes; long waits still mostly fall with fewer than 3 waiting (14 of 15 over 8 min)
- length: his answer wait is flat under 1,500 chars (1.6 / 1.5 min median), 3.0 past it (79 of 430 turns since 10-28); a correlation
- advice share: main's median reply 1,146 → 336 chars, replies with an opinion or proposal 48 % → 33 %; wings run ~40 % longer than main
- --bg on the board: 519 orbit calls in the wing days, 95 % phases no board draws (~165k tokens); 6 of 9 asks unanswered at the session's end
- grills only in orbit: 6 of 102 rounds since 10-28, 5 from side or wing seats, 2 after the 11-07 rule
- not measured this run: buried pushback, boundary vs mid-task timing, sycophancy (each needs a model read); labels pattern-only, the gold set is keyed to run 1's ids
- the raw tables: the recipe's `last/` (gitignored), `hunts-result.md` the read

## levers

- landed 2026-11-09 (his yes, PK-364): the 1,500 cap in every seat, the ➡️ line carries the take or the need, a risk never softened, styles tone-only (`output-fun` → `output-crew`, glados guarded identical), --bg writes no phases, wings start in glados; open: [FRM-540](https://linear.app/x-com/issue/FRM-540) --bg phases in the mod, [FRM-541](https://linear.app/x-com/issue/FRM-541) the grill guard, [FRM-542](https://linear.app/x-com/issue/FRM-542) every seat's prompt log, [FRM-543](https://linear.app/x-com/issue/FRM-543) the wish check on briefs
- landed 2026-10-10 (his yes): the reply budget, one home for the next move, «ok» accepts the fence, glosses, proof in commits, a)/b) choices, push + commit batched per siesta
- landed 2026-10-10 → 10-12, mod-shaped: asks in orbit, phases, glide lane cards, 🐠 catch, quiet comms (💨 slipstream); still open: the plugin-reload friction

## what the research says (run 1, 2026-10-10; exa, parallel, researcher)

- routine approvals train rubber-stamping: 93 % of Claude Code permission prompts get approved, and Anthropic names it approval fatigue ([measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy), 2026) — moves: the routine-asks batching, already landed
- a structured multiple-choice ask with a default beats a prose list: `AskUserQuestion` in Claude Code, one-tap buttons in Devin (2026-09-25), number keys in Factory (2026-09-02) — moves: the mods plan (verdict clicks)
- every big vendor shipped the same fleet view in Aug–Oct 2026: needs you · ready to review · working, one line each, notify only on «needs you» — moves: the trackers-to-a-pane mod; prior art to borrow, not build from zero
- long replies go with uncertainty («verbosity compensation», 14 of 14 models, [arXiv 2411.07858](https://arxiv.org/abs/2411.07858)) — moves: the reply budget, and a hunt (does a long reply predict a correction?)
- an output style is a prompt, not a guarantee, and it skips in-process subagents (the `Agent` tool); every session loads the user-level `output-crew`, codies and sixth senses included ([output styles docs](https://code.claude.com/docs/en/output-styles)) — moves: the budget needs a hook check (`reply-check`); subagent reports need their own line in their brief
- a decision log the agent checks before asking cuts re-asks (Aporia, 5× fewer model mismatches, [arXiv 2604.05203](https://arxiv.org/abs/2604.05203)) — moves: the re-ask fix; our pocket «decisions so far» and memory are that log, not yet consulted before an ask
- models copy the wording of non-native prompts and answer them worse (FABLE, Sep 2026, 34 models; whether it explains our corrections is untested) — informative; the wish fold and the wispr dictionary are the levers we already have
- the human's review speed is the ceiling: one review lane at a time (Simon Willison, 2025-10-05) — informative
