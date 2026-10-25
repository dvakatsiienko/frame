---
id: PK-94
title: >-
  after the sweep: the cli big picture — state, PRODUCT.md, the top 5 chunks
  shape-laned
status: done
assignee: []
created_date: '2026-10-12 11:45'
updated_date: '2026-10-25T11:45:00Z'
due_date: '2026-10-26'
labels:
  - m
dependencies: []
priority: later
type: wish
ordinal: 100010
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the memory sweep (FRM-267) to close — it runs right after.
split from PK-50 step 4 (dima, 2026-10-10 14:50, folded): review the cli's state, read its PRODUCT.md, a few turns of high-level planning. the «planned scope» exists somewhere, prepped earlier on his wish for a highly efficient plan of the most useful cli features. the most useful features solve the most wanted fleet issues: fleet hazards, the most frequent actions. the goal: streamline the fleet and automate repeating operations; truly solve problems, never automation for its own sake. then gradually migrate the frame pnpm scripts into the cli, only where it makes the system better. reassemble the big picture, name the nearest best picks for the next cli lanes, pick the top 5 chunks and shape-lane them.
- riders kept from PK-50: FRM-360 (the frame around interactive screens) joins the nearest cli chunk; cli chunk 2 line (dima's 🤩, 10-10): `x linear body --set` refuses an empty or near-empty file — it let cclio blank FRM-382 for a minute
- input: PK-92 (glossary-term gate) and the x domain-modeling run's ADRs (01f5fbf2)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: right after the memory sweep (FRM-267) closes — dima, 2026-10-12 14:44

moved from PK-50 at its close (wishkeeper 15:49: the close dropped them), whole, his verdicts kept:
- cli chunk 1 `verify`, decided (grill round 1, 2026-10-10 20:49): V1 one `x verify` family, `red` (red-proof ported, the bash bin dies in the same commit) + `mutate` · V2 a build or type error reads «broken», never «red» · V3 every mutation runs in a temp copy of the tree with `X_VERIFY=1` set · V5 the runner is picked from the file, `--` overrides · V6 feature lane, one go coder · V4 a mutation is exact anchor → replacement pairs, a pairs file for many, no perl or regex
- cli chunk 2 lane gaps, decided (grill round 1, 2026-10-10 21:07): L1 three doors — `x lane new` (worktree + seed), `x lane restore <path>`, `x retro write` · L2 `x lane gate <cmd>` keeps the full log in a file, prints status + the last lines · L3 a restore saves the current file to the job tmp first · L4 `x linear body --set` refuses a file under a fifth of the pulled size, the pull prints its path loudly · L5 feature lane, the same go coder right after FRM-383
- every cli chunk that lands prints the x LOC diff, lines added and removed (dima's curiosity, 2026-10-10): `pnpm x-cli-go:loc` before and after
- pre-prepped for chunk 3: PK-48 + PK-49 with `.scratch/x-stats-board/spec.md` (14 stories, never built), and FRM-360 (grilled rounds 1–2, mock-first exits)
- cli chunk 2, blind critic folds (plan 20261010211139): every guard refusal names its x verb (`git checkout --` → `x lane restore`, `| tail` → `x lane gate`, a hand worktree → `x lane new`, a shelf write → `x retro write`) · the body guard compares against the size recorded at pull time, `--shrink` allows an honest cut · `x retro write --replace` keeps the old as `.prev`, the source lives in the job tmp, never the worktree · `x lane new` calls the `x lane seed` code and the test asserts that call
- cli chunk 2 line (dima's yes, 2026-10-10): `x brief check` flags a brief whose paths sit under `plugin-x/mods/` and names no `plugin-authoring` (the restarted FRM-381 coder missed it)
- cli chunk 2 L6 decided: `x lane restore` works only inside an agent's own worktree (refused in a main checkout) and backs up into a git ref, never a prunable tmp
- cli chunk 3, S1 decided (21:29): the stats board + the size view + FRM-360's frame in one chunk. dima, folded: «don't scale the visually appealing parts before they're approved. build something visually cool on one screen first; i see it, approve, disapprove or steer, then we scale the settled approach to other places. i'll steer how i want it to look, we settle a few vibrant screens, and over time i steer less, because coders will have lots of refs of how i want things to look — a settled design language»
- cli chunk 3 decided (21:33): S2 the size view is a tab on the stats board, plus `x stats --size --json` · S3 build now on 2 days of telemetry · S4 ntcharts stays only under +10 ms startup and +3 MB binary, and first an A/B showcase screen: the same charts drawn twice, ntcharts on top, hand-drawn below, so the gain is visible (dima: «ask coders to print a few examples») · S5 a second go coder runs it in parallel with the verify coder
- cli lane launch (dima, 2026-10-10 22:30, o70): not today — today only the mods lane runs; keep planning until 5–7 cli chunks are sealed, then the spawns
- cli chunk 3 sealed as FRM-387 (22:27, 6 exit lines, preflight green, related FRM-360); the critic folds were: the board and the frame mock need one approval order; an agent pty must never hang on the board (a non-interactive path); measure ntcharts after the stats package imports it, not on a throwaway; goldens hold the settled frame; grep `x-cli-go:loc` callers before deleting it
- cli chunk 4 mods verbs, decided (grill round 1, 2026-10-10 22:59, dima approved all): M1 `scratch-edit` becomes `x mods edit pull|push|status` (150 runs in 14 days) · M2 `pnpm mods:test` takes a mod name, a guard points raw `claude plugin test` at it (355 raw runs) · M3 `x mods edit push` runs `claude plugin validate` before writing (57 raw) · M4 `x plugin status`: source vs cache version per plugin (114 raw claude plugin calls) · M5 mods:live and mods:probe stay pnpm. next: the mods coder's and verifier's wants (dima asked), then round 2 if they add any
- cli chunk 4 round 2 (the mods coder's and verifier's wants, 23:00; dima left the calls to cclio, 23:04): R1 `x mods edit test` runs validate + tests on an overlay copy, push runs it and refuses on red · R2 push is all-or-nothing, only pulled paths plus `--add` files · R3 mutation proofs on a mod fold into FRM-383's `x verify` (steer before its spawn) · R4 `pnpm mods:test <mod>` prints the summary and failures only; `--extra <file>` runs one more test file from outside tests/ (dima ticked it, o83, over cclio's cut) · R5 a typecheck that checked 0 mods exits red · R6 `x mods gates <ticket>`: typecheck + test per ticket commit (scripted twice, the third time automates) · R7 mods:live gets `fill`, a ready line, `status` naming the slot holder
- cli chunk 4 round 3 (interview round 2, 23:05, both «enough»): R8 `x mods edit test --against HEAD` runs the edited tests on HEAD's hooks and names which fail there — the red-on-old-code proof the coder ran ~12 times tonight (cclio's call, dima left it to her) · the verifier's caveat on a red scratch test locking x-mod-guard is met by `--extra`, which runs a file from outside tests/
- cli chunk 4 split on the critic's scope finding (dima, o90): 4a FRM-388 the mods edit loop (5 exit lines, sealed 23:16) → 4b FRM-389 gates, plugin status, mods:live signals (4 exit lines, sealed 23:18), FRM-388 blocks FRM-389; FRM-383 gained a mods target (exit 6)
- tomorrow (dima, 2026-10-10 23:26): resume the mods lane (paused today) until the planned mods scope is done (FRM-382, FRM-385, FRM-386); then dima takes over the mods coder and refines the shipped scope (keep or cut) while the main lane runs. the cli lane starts after the mods lane, sequential, never parallel
- cli chunk 6 (github), grilled 23:21–23:26: G1 `x gh pr` merge with a CLEAN guard, G2 `x gh read`, G3 guard hints — dima ticked all, then asked why wrap a mature gh at all; cclio's re-check: diff is a thin alias (fails admission), raw reads need only `-H "Accept: application/vnd.github.raw+json"` (proven 23:27 on cli/cli README), so G2 becomes a github-contrib tip; the merge guard is the one real hazard
- cli chunk 6 dissolved (dima, o98, 23:29): the merge guard rides FRM-384 as exit 6 (`x gh pr <n> --merge` refuses unless CLEAN), raw reads became a github-contrib tip, diff dropped. the cli plan stops at 5 sealed chunks: FRM-383 verify, FRM-384 lane gaps, FRM-387 stats board, FRM-388 mods edit loop, FRM-389 mods gates
- the same «does it beat the tool it wraps» audit over the 5 sealed cli chunks (dima, 2026-10-11 00:01), to settle before the cli lane starts: keep FRM-383 (red-proof 226 raw runs) but ask whether `mutate` folds into `red --pairs` — evidence for keeping a mutation verb: the FRM-382 verifier found 6 of its 8 findings by mutations and throwaway probe tests, and asked for `x lane mutate` (2026-10-11); FRM-384 keeps `lane new`, `lane gate` (13 gate-pipe refusals), `lane restore` (git checkout -- 12) and the merge guard, while `x retro write` has no raw-call evidence (0 cp-to-retros) and is a cut candidate; FRM-387 stays as shaped, the ntcharts A/B and the spring included (dima, 00:08: «i like to explore the diff»); FRM-388 stays; FRM-389 keeps gates and the mods:live fixes, while `x plugin status` rests on an inferred question and is a cut candidate
- the drift check ran (2026-10-11 12:07, cli-drift-check over FRM-383/384/387/388/389, census 382 calls over 3 days): rank 388, 383, 384, 389, 387; `mutate` merges into `red --pairs` (`bin/red-proof:12` already runs `--cmd --pairs`, verified); `x retro write` stays — the 00:01 cut overturned, 16 hand writes into shelf/retros with 3 path spellings, 5 of them `cat >>` addenda, so it gains `--append`; `x plugin status` cut (6 of 21 raw `plugin list` reads sampled, all asked enabled state); `x mods gates` seeds its temp tree through `x lane seed` so a 0-mods check reads broken; a guard hint sends the 36 raw plugin `update` calls to `x plugin bump`. the chunk bodies change on dima's word (o33)
- tail for the cli or bytes lane (o39, 2026-10-11): the apps-essentials checker walks tooling areas too, red when an area has no `<area>-verify` skill; the contract line is in `x:app-setup-essentials` step 4
- FRM-388 candidate from the FRM-382 coder retro (2026-10-11): `scratch-edit test <mod>` — copy the mod, overlay the scratch file, run `claude plugin test`; the coder hand-rolled it as try.sh and ran it ~15 times. folds into FRM-388 when its lane is prepped
- the next cli candidates, ranked (dima o46, 2026-10-11; no tickets until the cli lane opens, re-census then):
  1. `x pocket` — claim, park, done with pocket-check built in (backlog 114 raw runs in 14 days; 3 pocket reds tripped today)
  2. `x linear line` — strike-and-replace a sealed exit line, renumber-safe, preflight after (~6 hand body edits on 10-11)
  3. `x hook test` — a fixture HOME plus mutations for hook tests (FRM-380 verifier asked; hand-built for reply-check 10-11)
  4. `x recipe list` — overdue recipes surface by themselves (dima 10-07)
  5. `x retro gather` — retros grouped by type for the halt's fold
  - python3 tops the census at 1,694 raw runs (inferred: mostly inline edits that skip edit hooks); 1 and 2 absorb part of it

retro 10-12 (mods coder) automation candidates: `x peer send --after <s> <to> <text>` (a delayed cross-session send, no model, for idle probes); `x mods edit red <pairs-file>` (the mutation loop over the overlay copy).

dima o62: x knowledge list gains the recipe ↔ shelf map, both ways; red on a shelf file with no fed-by, an artifact path that does not exist, a recipe never run.

guard candidate (18:01 flawlog, ccrow 18:19): x brief check reds a ~/frame/cclio/ path in a brief for a non-cclio session.

10-12 retro fold (lane l12 + arm A), verb candidates for the cli big picture: `x mods edit test --tsc` (tsc inside the overlay test — cost commits twice) · `red-proof --names` + `--keep-output` (a flake in red-proof is unreadable today) · `x mods edit red <pairs-file>` · `x peer send --after <s>` (idle-delivery probes, no model) · `pnpm mods:banner <text>` · `x eval why <run>`

halt flush 10-12 (o148): x lane commit's envelope gains `hooks: <n> ran, <list>` — today «did the gates run» is unprovable from a green envelope (arm A retro)

18:30 folded from PK-92 (o157): x lane gate must not let a glossary rewrite drop a term silently — a cli lane chunk

18:52 two cli chunks from the mods coder's l14 retro (automation candidates): red-proof --pairs accepts \n escapes in anchors; x mods edit push runs biome check on the files it writes (biome's key sort failed two commits at the hook). and one from cclio's own brief miss: x brief check reds a «<file> § <heading>» pointer whose heading grep can't find (the brief named fleet-models.md § cost, which doesn't exist)

close: done — chunks sealed as FRM-383/384/387 (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
