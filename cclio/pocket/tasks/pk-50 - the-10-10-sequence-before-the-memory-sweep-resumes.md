---
id: PK-50
title: the 10-10 sequence before the memory sweep resumes
status: claimed
assignee: []
created_date: '2026-10-10 11:52'
labels:
  - m
dependencies: []
priority: now
type: wish
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-10 14:50, folded. sequential, one at a time, no parallel lanes yet.

1. [x] big picture planning, now: if dima ever said «proceed without me», which route through the roadmap and the nearby plans is optimal, the best gains for the least effort, to build a great fleet system? plus an evaluation of dima as operator: how effective his prompting is, and an operation-efficiency report with interesting data and stats, what he asks the most
2. [x] big picture, overall (dima: the roadmap initiative; cli moved off the order into a parallel track, its evolve contract in the initiative body)
3. [ ] mods that solve the comms issues and improve his ux (dima 15:18: mods first, the cli after)
   - mod idea (dima, 15:50): the trackers he reads but never answers (🔭 / 🛰️ / ⏲️ who we wait on, the stat boards, the 📄 stamp) move out of the replies into a mod; groom, grill, test drive
   - mod flaw (dima, 16:28): x-mod-stash checks the ⏳ fence in a Stop hook, after the reply, so a fix costs a second print and a turn; it should warn before the answer goes out, and accept sections split by a blank line (one line per item stays)
   - the mods brief names the bundled `plugin-authoring` skill as step 0 (dima 16:38: 7 loads in a week, 1 of them a coder)
   - the reply analysis (`~/frame/.scratch/reply-analysis-2026-10-10.md`) proposals 4 and 8: the ⏳ fence in a side pane with accept-all, the add-ons (skills line, 🔥) to a log
   - input (dima, 15:13: «keep this report in mind when we start planning mods»): the [Operator Ledger](https://claude.ai/artifact/CJmBAGi8tJ9wyh8FW3kx9o) and the comms answer of 10-10 15:2x, numbers in `x fleet flow` and the ledger: 495 bare approvals, 637 questions, 127 plugin reloads, 57 re-asks
4. [ ] big picture, cli: review the cli's state, read its PRODUCT.md, a few turns of high-level planning
   - the «planned scope» exists somewhere: prepped earlier on his wish for a highly efficient plan of the most useful cli features
   - the most useful features solve the most wanted fleet issues: fleet hazards, the most frequent actions
   - the goal: streamline the fleet and automate repeating operations; truly solve problems, never automation for its own sake
   - then gradually migrate the frame pnpm scripts into the cli, only the ones where it makes the system better
   - reassemble the big picture, name the nearest best picks for the next cli lanes, pick the top 5 chunks and shape-lane them
5. [ ] close all tails: fully solve everything in the pocket that can be solved
6. [ ] resume the memory sweep, his steers first

standing: use the advisor actively, above all during planning; ccrow comes later.
- step 4 note (dima, 2026-10-10): FRM-360, the frame around interactive screens, joins the nearest cli chunk while he is here, instead of waiting for him to drive x
- cli chunk 2 (lane gaps) line (dima's 🤩, 2026-10-10): `x linear body --set` refuses an empty or near-empty file — it let cclio blank FRM-382 for a minute
- cli chunk 1 `verify`, decided (grill round 1, 2026-10-10 20:49): V1 one `x verify` family, `red` (red-proof ported, the bash bin dies in the same commit) + `mutate` · V2 a build or type error reads «broken», never «red» · V3 every mutation runs in a temp copy of the tree with `X_VERIFY=1` set · V5 the runner is picked from the file, `--` overrides · V6 feature lane, one go coder · V4 a mutation is exact anchor → replacement pairs, a pairs file for many, no perl or regex
- cli chunk 2 lane gaps, decided (grill round 1, 2026-10-10 21:07): L1 three doors — `x lane new` (worktree + seed), `x lane restore <path>`, `x retro write` · L2 `x lane gate <cmd>` keeps the full log in a file, prints status + the last lines · L3 a restore saves the current file to the job tmp first · L4 `x linear body --set` refuses a file under a fifth of the pulled size, the pull prints its path loudly · L5 feature lane, the same go coder right after FRM-383
- every cli chunk that lands prints the x LOC diff, lines added and removed (dima's curiosity, 2026-10-10): `pnpm x-cli-go:loc` before and after
- pre-prepped for chunk 3: PK-48 + PK-49 with `.scratch/x-stats-board/spec.md` (14 stories, never built), and FRM-360 (grilled rounds 1–2, mock-first exits)
- cli chunk 2, blind critic folds (plan 20261010211139): every guard refusal names its x verb (`git checkout --` → `x lane restore`, `| tail` → `x lane gate`, a hand worktree → `x lane new`, a shelf write → `x retro write`) · the body guard compares against the size recorded at pull time, `--shrink` allows an honest cut · `x retro write --replace` keeps the old as `.prev`, the source lives in the job tmp, never the worktree · `x lane new` calls the `x lane seed` code and the test asserts that call
- cli chunk 2 line (dima's yes, 2026-10-10): `x brief check` flags a brief whose paths sit under `plugin-x/mods/` and names no `plugin-authoring` (the restarted FRM-381 coder missed it)
- cli chunk 2 L6 decided: `x lane restore` works only inside an agent's own worktree (refused in a main checkout) and backs up into a git ref, never a prunable tmp
- cli chunk 3, S1 decided (21:29): the stats board + the size view + FRM-360's frame in one chunk. dima, folded: «don't scale the visually appealing parts before they're approved. build something visually cool on one screen first; i see it, approve, disapprove or steer, then we scale the settled approach to other places. i'll steer how i want it to look, we settle a few vibrant screens, and over time i steer less, because coders will have lots of refs of how i want things to look — a settled design language»
- cli chunk 3 decided (21:33): S2 the size view is a tab on the stats board, plus `x stats --size --json` · S3 build now on 2 days of telemetry · S4 ntcharts stays only under +10 ms startup and +3 MB binary, and first an A/B showcase screen: the same charts drawn twice, ntcharts on top, hand-drawn below, so the gain is visible (dima: «ask coders to print a few examples») · S5 a second go coder runs it in parallel with the verify coder
<!-- SECTION:DESCRIPTION:END -->
