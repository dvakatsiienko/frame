---
id: PK-219
title: >-
  next cli lane: shape its scope — cli 1 runs before mods 1, FRM-401 its first
  chunk, gh stacks as an extension
status: done
assignee: []
created_date: '2026-10-20 13:42'
updated_date: '2026-10-22T16:51:00Z'
due_date: '2026-10-24'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the pm revamp (PK-103) done in full — dima 2026-10-22: «let's try cli lane today after pm is revamped fully» (was: the refresh-crew-coordinator run, o44) — then spawn cli lane 1 (FRM-401 → 403 → 405 → 404, sealed)
dima 2026-10-20 16:41, folded: since gh stacks and stacked prs need cli changes, plan the next closest lane as cli 1, not mods 1. shape a scope for it — i don't plan to spend too much effort on the cli lane, but i want it to do a meaningful chunk of useful stuff. there are preplanned chunks already (PK-74 rebase-not-merge, PK-134, PK-145, PK-151, PK-185, PK-189, PK-190, PK-199, PK-200, PK-201, FRM-383, FRM-384, FRM-387): refresh them, review, adjust if in good shape and ready to dispatch. FRM-401 is the lane's first to-do. on FRM-401 and stacks: be careful, gh stacks are unverified and we may discard them — the changes must not break the existing flow; the cli supports both modes, plain prs and gh stacks, as an extension easy to delete; even if stacks are set aside, the support may stay for a later revisit. formulate the specs with these notes in mind. stacks blockers to fold: docs/knowledge/pr-flow.md (pr-open base, merge-main merge commit, push no force, crew-coder no-rebase). doors: cclio:shape-lane, cli-drift-check.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 17:03 decided (dima o35, o36, o37): lane 1 = FRM-401 merge-auto + PK-74 rebase-main + the stacks piece with its 4 gaps (review re-arm on restack, bottom-up merge with gh auto-merge off, layer branch names, the clone-lock refusal) + PK-134 verify-tree + riders PK-190, PK-145, PK-151; ~1.5–2 coder sessions. cli 2 = FRM-383, FRM-384, PK-199..201; cli 3 = FRM-387; PK-185/189 → the mods lane. lane 1 sealed now, lanes 2–3 refreshed right before each starts. linear's stack settings: a one-time check at the stacked-prs trial's first round, not cli work. scope file: ~/frame/.scratch/cli-1/scope.md

2026-10-20 17:10 grill r1 (dima): Q3 layer names = coder/<ticket>-<slug>-2, -3 (o40 ✓). facts read for r2: bytes review:clean runs only on the 🤖 review:requested label and is a required check keyed on the head sha, so a restack leaves an upper layer with no review:clean until relabeled (one paid review per layer per restack); both repos have github's allow_auto_merge on; gh-stack's lock waits 5 s then exits 8 (#568), a paused rebase blocks every other stack command in the clone until continued or aborted (#570).

2026-10-20 17:13 grill r2 (dima): Q1 the brake has no stored flag — each merge-auto run reads git history; a revert of a merge-auto merge in the last 7 days closes it, it lifts itself after 7 days; merge-auto tags its own merges so a revert is findable (o38 ✓). Q2 the verifier's clean carries over a restack when a layer's patch-id is unchanged; bytes' review relabel cost is measured in the stacked-prs trial, not changed now (o39 ✓ «lets try»). Q4 a busy gh-stack lock is retried up to 2 min; a paused rebase refuses at once, naming its worktree and the continue/abort command (o41 ✓ «let's try»). merge-auto never turns on github's own auto-merge (stacks don't support it, #504). frontier empty → to-spec next.

2026-10-20 17:25: test seams confirmed (o42 ✓) — the x binary as a process, fakeGithub, temp git repos, one new fake gh stack on PATH. gh stacks need no setup: docs.github.com «Stacked pull requests require no setup or enablement»; a stack is per pr chain, plain prs stay side by side in the same repo. our research's «exit 9 = stacks not enabled» is not in gh-stack's README (codes 0–8) — drop it from the spec. setup left: gh-stack extension (gh ≥ 2.90.0) + its agent skill.

2026-10-20 17:33 dima: the gh stacks setup chores (extension + agent skill, linear's code-review setting) run when we get close to gh stacks — after cli lane 1 lands or alongside it.

2026-10-20 17:45 sealed: FRM-401 (7 exits), FRM-403 (7), FRM-405 (4), FRM-404 (6, blocked by 401+403); blind critic 20261020173530 — 5 findings folded (sha-pinned merge, skipped/0-required checks, rename + page-2 + self-edit risky cases, patch-id rule in core, build tag for the add-on, hook-installed check); all 4 preflight green. spec: ~/frame/.scratch/cli-1/spec.md

2026-10-20 17:41 dima o44 ↩️: no parallel lane now — the main lane has lots to do; spawn any lane only after the refresh-crew-coordinator recipe run (PK-90 + the PK-213 blueprint) resolves.

18:08 note: wishkeeper flagged two slips here — the «17:45 sealed» stamp ran ~17:38, and o39/o41 were ticked on trust: dima, o41, folded: «honestly, i still didn't get how it works — it's tricky for me to follow the tech details, but i decided to believe your proposition. let's try.» re-explain the stack mechanics at the first stack lane.

**waiting for:** the refresh-crew-coordinator run (dima o44: spawn any lane after it) — then spawn cli lane 1

18:10 correction of the 17:25 note: gh-stack DOES have exit 9 (ErrStacksUnavailable, cmd/utils.go:36, on a stacks-api 404 — «not enabled for this repository»); the readme's table stops at 8. FRM-404 refuses at once on it. the researcher lane caught my wrong fix.

2026-10-22 15:05 dima: «let's try cli lane today after pm is revamped fully» — the gate moves from the refresh-crew-coordinator run to the pm revamp (PK-103)

2026-10-22 18:00: the 10-20 waiting line above (the refresh-crew-coordinator run) is superseded; gate now: the pm mechanisms build (done 10-22) + the cli milestones proposed — dima W86: spawn the cli lane today

2026-10-22 19:0x the wish, one point per line (folded from the 10-20 16:41 drop above, his words kept), so the spec can cite them:
W1 since gh stacks and stacked prs need cli changes, plan the next closest lane as cli 1, not mods 1
W2 i don't plan to spend too much effort on the cli lane, but i want it to do a meaningful chunk of useful stuff
W3 there are preplanned chunks already: refresh them, review, adjust if in good shape and ready to dispatch
W4 FRM-401 is the lane's first to-do
W5 be careful with gh stacks: they are unverified and we may discard them; the changes must not break the existing flow
W6 the cli supports both modes, plain prs and gh stacks, as an extension easy to delete; even if stacks are set aside, the support may stay for a later revisit
W7 formulate the specs with these notes in mind
W8 ❓ (10-20 o41) honestly, i still didn't get how it works — it's tricky for me to follow the tech details, but i decided to believe your proposition; let's try; re-explain the stack mechanics at the first stack lane

2026-10-22 19:55: cli lane 1 spawned (☕️ 🔧 FRM-401 code: merge-auto), scope sealed in .scratch/cli-1/spec.md; W8 stays with cclio at the first stack step

close: W1 done (cli lane 1 runs before mods 1) · W2 done (the minimal cut lands first, chunk by chunk) · W3 done (chunks refreshed into FRM-401/403/405/404, sealed 10-22) · W4 done (FRM-401 is chunk 1, spawned 19:50) · W5 moved to FRM-404 (the add-on never touches the plain flow, its removal test) · W6 moved to FRM-404 (a removable extension) · W7 done (.scratch/cli-1/spec.md) · W8 moved to cclio at the lane's first stack step (FRM-404's spawn)
<!-- SECTION:NOTES:END -->
