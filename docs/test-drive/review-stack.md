---
dies-when: both measurement prs are scored and the two decisions (local order; greptile cli / ci / both) are written into `x:crew-coder`'s «final» chain — then the sheets fold into gh-stack-adoption's decision log and this file is deleted
---

# review stack — the measurement run

split out of `gh-stack-adoption.md` step 3b on 2026-09-10 so the stack plan stays a plan and the measurement stays a sheet. the pre-run on trophy-sys (overnight 2026-09-10, sequence-biased) is `adversary-lane-greptile-vs-coderabbit.md`.

## the plan (dima, 2026-09-09) — binding until both prs are scored

**what is decided by it:** (1) which local cli goes first in the coder's fallback chain, coderabbit or
greptile; (2) whether greptile runs locally (cli), on ci (`@greptile review`), or both.

**the target shape after the run — dima's sequence, verbatim in spirit:** when the coder is done,
before asking the ci action: **one** local adversary review from the available set. first the winner
cli (one review, fix what it decides is worth fixing); off quota → the other cli; off quota too →
matt's `code-review` (free floor). the coder always gets one local review, whichever quota is alive.
then push, then the ci adversaries.

**the run — two real coder prs, not synthetic, medium size with real logic (docs-only diffs draw
only nits):**

- on the **same final commit, before any fix**, the coder runs all three local tools: `coderabbit
  review --agent --base main -c CLAUDE.md`, `greptile review --agent` (via greploop, cap 1),
  `mattpocock-skills:code-review`. all three see identical code — tool 2 never gets credit for
  tool 1's cleanup.
- records per tool, then fixes what it accepts, pushes, comments `@claude review` and
  `@greptile review` in the same minute.
- the sheet, per pr, per tool (5 local/ci entries): **true findings** (real defects) · **noise**
  (wrong, trivial, lint restatement) · **time to result** · **unique** (caught by nobody else) ·
  **credits spent** (greptile: read the counter before/after; coderabbit: rate-limit hit y/n).
  the coder fills it in its retro; cclio copies it into the ticket comment.
- **decision 1, local order:** most unique + true per minute goes first; the other is the quota
  fallback; matt's the floor. tie → coderabbit first (hourly quota refills, greptile's monthly
  does not).
- **decision 2, greptile env:** ci pass finds nothing unique vs the cli pass → greptile becomes
  **cli-only**, `@greptile review` leaves the brief, the empty-open credit question dies. ci finds
  unique things (pr context, comments, full repo index) → **ci-only**, the local slot goes to
  coderabbit. both unique → keep both.
- also read on pr 1: did the automatic first review on the empty-commit pr open run and cost a
  credit (filters: `renovate/*` excluded, auto-review-on-commits off)? yes → a `review-ready`
  label rule is the fix, dima's word first («no labels spam yet»).
- after pr 2: `x:crew-coder` switches to the fallback chain with the winner first; this
  section folds into the decision log.

**measurement 0 — the overnight pre-run (dima, 2026-09-10, `bytes-b1`):** greptile vs coderabbit on
trophy-sys, ~2900 lines, full write-up in [adversary-lane.md](adversary-lane.md).
counts as a data point, **not a decision** — dima's caveats: it ran after the deploy, and coderabbit
started after greptile's fixes (the doc's own sequence-bias section; the worktree re-run patched it
partially). what it does settle for pr 1 and 2: 1-in-5 overlap, zero false positives from either,
greptile anchors lines + flags security + gives a verdict, coderabbit covers the frontend + ships
patches + carries injection hygiene, and **re-review after every fix** is tool-independent. so the
sheet keeps its five columns; the tie-break stays coderabbit-first; greptile's latency is the one
number nobody has yet — time it on pr 1.

**pr 1 — bytes #67 (BYT-83, trophy-sys follow-ups + cn), scored 2026-09-10 on commit `dcb6d892` before any fix:**
- coderabbit — true 1 · noise 0 · 85 s · unique 0 · rate limit not hit
- greptile — true 0 · noise 1 (`rel=noreferrer noopener`, spec-wrong) · 198 s + one 151 s server-side failure · unique 0 · 2 review ids spent (the cli exposes no counter)
- matt's `code-review` — true 5 · noise 0 · ~40 s · unique 4
- ci `@greptile` — round 1: 0 unique (same as its cli finding) · round 2 on `7370b683`: 5/5 confidence, 0 findings
- ci `@claude` — round 1: clean, 0 findings · round 2: **failed, `Reached maximum number of turns (30)`, nothing posted** — a 9-commit diff exhausts the cap and the reviewer drops out silently; the cap in `.github/workflows/claude.yml` is the fix, dima's call (ci config)
- greptile's one cli finding was withdrawn by greptile itself when challenged
- round 3 on `bc9c0638` (max-turns 60): `@greptile` 5/5 zero findings; `@claude` **true 2 · noise 0 · unique 2** — both failure-state defects nobody else saw (a mutation error hiding the whole control block; a `CLAUDE.md` still claiming a removed setting). the coder first reported it as «0 findings»: the run said success before the comments posted — **success with no inline comments means «clean» OR «not posted yet»; poll the comments endpoint after the run, never infer from run status** (brief line)
- **decision 2 taken on pr 1 (dima, 2026-09-10): greptile is cli-only** — `@greptile review` left the brief (0.11.53); the on-open infographics would need auto-review-on-commits, which reviews half-done pushes and spends a credit each. decision 1 waits for pr 2.
- corrected ranking on this pr: matt (5/4 unique, free) → ci `@claude` (2/2 unique, later commits) → coderabbit (1/0) → greptile (0 across cli + ci, three rounds)
- **the coder's larger finding:** three of its six real defects came from running the app (a browser at two widths, an end-to-end token clear); no reviewer found any of them. the lane has five reading steps and zero running steps → a «drive it once at two widths before final» step is the brief change this pr argues for, ahead of any reviewer reordering
- coder's read: decision 1 → matt first, coderabbit second, greptile last or dropped; decision 2 → ci found nothing the cli did not, both rounds, and the cli found nothing true either. one pr, flagged not called; BYT-81 = pr 2 decides
- the one real defect (`monthTicks` floor of 2) found by coderabbit AND matt independently
- empty-open credit question: **no** — greptile did not auto-review on open; no credit on the empty commit
- coder's read, flagged not decided: on this pr greptile does not earn the local slot; matt's is strongest and free; coderabbit fast and precise. one pr; pr 2 decides.

**candidates (real, medium):** space-explorer-ui error boundary + api `cancelTrip` without
`validateAuth` + `bookTrips` validate-before-auth (one pr); `.cursor/rules` delete + root
`AGENTS.md` pointer is too docs-shaped for pr 1, fine as a third. dima picks; 2026-09-10 after
DOT-26.

---


## pr 2 — bytes #68 / BYT-85 (2026-09-11), coder's own tally, cclio verified the ci rounds

per layer, on the same job, unique = found by no other layer:
- coderabbit — 2 minor, 1 unique (row + note guarding the record separately)
- matt's `code-review` — spec axis 1 (the grant row could not take its own reading — five other layers passed it) · standards axis 0 hard, 3 smells, 2 taken
- greptile cli (greploop) — 3 real, 3 unique (best: an npsso paste undone by a refresh in flight)
- ci `@claude review` — round 1: 1 inline, real, unique (the coder's own epoch fix ordered backwards) · round 2: clean, ~13.5 min per round, the action step alone
- the coder's own run: the 10-day non-resetting grant, from one live call — no reviewer could have

verdict so far: every layer except the standards axis found something unique. nothing cuttable on two prs. the spec axis is the one that earned its place.

## greptile lanes, added 2026-09-11 (dima: measure cli vs ci, and the chat)
per pr while the github app is on trial (to ~09-16): greptile cli (greploop) and `@greptile review` on the same head — findings, unique, time, credits; **chat**: how many exchanges the coder had with greptile on the thread, how many verdicts flipped (greptile withdrew, or the coder changed a «declined»), and whether any exchange taught something the cli finding alone did not. the chat earns the app only if a verdict flips or a lesson lands.

**the diagram axis (dima, 2026-09-11, on #75):** greptile's ci summary carries a mermaid flow of the change — «useful to understand flow (for me), but ugly». it is a separate point from findings: scored on its own line per pr (did the diagram explain the change faster than the diff?), cli vs ci kept apart. decision option: greptile leaves ci on findings alone — then the diagram wants another source. later, whatever the decision: a beautiful diagram representation of a pr's flow (house mermaid theme, svg, or an artifact) — not before the trial ends.

## pr 5 — bytes #75 (review gate), 2026-09-11
- ci `@claude` — round 1: 3 real (one fatal: the gate could never close) · round 2: 1 real (`updateComment` keeps the author, the half-fix) · cap spent
- greptile ci — 1 finding P2 (cleanup can erase rounds), confidence 4/5, diagram ✓ (dima: useful, ugly) · chat: not yet counted
- coderabbit / matt's / greptile cli — the coder's report did not tally them; fold when the done-comment lands
- idea (dima, 2026-09-11): the diagram need not come from greptile — the ci reviewer (`claude-code-action`) can be told to end its round with a mermaid flow of the change, or the coder can put one in the pr body at final. either decouples greptile's ci presence from its diagramming. measure after the trial: which of the three draws the more readable flow, and does dima open it.

## pr 6 — bytes #76 / BYT-91 (2026-09-11), coder's tally, cclio verified the rounds
- ci `@claude` — round 1: 6 real (one production break: `tsx` was space-explorer-api's runtime, hoisted away) · round 2: 3 real (a wrong react-compiler rule, a dead biome exemption, an overstated claim) · every finding fixed or declined with a reason on the thread
- greptile ci — 1 (P2), plus the diagram
- `review:clean`: false green on 4 of 4 rounds across #75 + #76 — the guard counts inline threads, the reviewer filed in the sticky comment every time → BYT-92
- the cap/check tension: per-head check, per-branch cap → #75 and #76 both merged past a pending gate → BYT-92's answer-check job

## pr 7 — bytes #79 / BYT-92 (the verdict gate) + pr 8 — #82 / #83 (2026-09-12), coder's tally, cclio verified the rounds
- unique findings across both: ci `@claude` **6** (the three sharpest: phantom round, the answer path re-opening #76, pr-controlled gate scripts) · matt's standards **5** · matt's spec **4** · greptile ci **3** · coderabbit **0** (~40 min per review, one review on a stale head)
- rounds on #79 were all red on the gate's own bootstrap (unjudgeable, uncounted); the contract measured end to end on #82: findings → red + counted (run 9), clean → green + counted (run 11); owner approval → green on #83's own lane
- **decision: coderabbit is cut from the coder chain** (the brief's own rule: two real prs, zero unique) — `x:crew-coder` 0.11.66. the local order is now matt's code-review → greploop → push → label
- open: greptile ci vs cli, decided with the trial (~09-16) → BYT-94 revisits the gate with one reviewer
- 2026-09-25 · #94 + #96 (atelier): the ci reviewer (opus medium, diff only) and the verifier (opus high, runs the app) caught **disjoint** defects two prs in a row — the reviewer 5 on #94 incl. 2 the verifier missed, the verifier 7 that needed running; on #96 the reviewer 1 P2 the verifier missed, the verifier 1 the reviewer missed. greptile is dropped (free plan: no cli); the local chain is matt's code-review → coderabbit
- 2026-09-28 · #111–#114 (trophy-sys) + #112 (essentials): all three layers found unique defects — matt's code-review in a fork caught the worst («Constructor» title crashing the library, #114), the verifier caught runtime ones (cross-view rounding, a surviving mutation, a public log route), the ci reviewer (diff only, 30–60 s) caught reading ones (an inverted comment, a root-only-commit gap). 📌 coderabbit still ran in coders' local chains despite the 09-1x cut: 0 unique on #113, rate-limited on #114 — the cut did not hold in the brief; re-check `x:crew-coder`
