# 🫙 pocket — cclio's local work pool

checked before linear, and emptied before linear. every inbox drop lands here as an item. linear holds the long shelf and the record; an item gets a ticket only when a coder takes it; linear work enters the order through an item that points at its ticket, so linear is never starved.

- an item: a `### NN · title` section below, its first line `status · type` (open · claimed · resolved; task · research · grilling · test-drive), then its ticket and `blocked by NN` when they exist
- what's next: the first open, unblocked, unclaimed item in «order» below. a new item takes the next number and joins «order» where it belongs, so the numbers never shift
- resolve: add one line to «decisions so far», then delete the item's section
- a coder-sized item gets a spec in the target repo's `.scratch/<feature>/` (`to-spec` → `to-tickets`, dima types them); the item links it

## order

19 → 25 → 26 → 11 → 18 → 27 → 01 → 02 → 07 → 06 → 08 → 22 → 23 → 24 → 05 → 09 → 10 → 12 → 13 → 14 → 15 → 16

## decisions so far

- 2026-10-07: 17 fixed: the stash asks list keeps only sessions the registry has alive, this session always (2 tests, both proven red); live: the dead cclio `91f2a33c`'s 6 asks drop at the next reload
- 2026-10-07: 19 + 21 resolved in one thread: the linear body is the spec seed (want · why · stories · proposed · decided · open · exit · out · refs), the boundary is in time (linear until dispatch, the spec owns the run, the outcome folds back); dima's flow plan wide → pre-grill → to-spec → to-tickets → dispatch is spec-pipeline run 2, first case the cli plan, to-spec'd live with dima to judge whether the spec lives in linear; user-only skills are run by reading their SKILL.md; tickets stay local (`.scratch/`, gitignored in frame, missing in bytes), die on merge; issue filed: [claude-code#100193](https://github.com/anthropics/claude-code/issues/100193)
- 2026-10-07: 03 no refs to protected.md anywhere. 04 bun = [FRM-148](https://linear.app/x-com/issue/FRM-148), oxlint = [BYT-38](https://linear.app/x-com/issue/BYT-38), both in monorepo m3 «the tool picks», roadmap step 9; `_hq/dima-roadmap.md` trashed, its two memory mentions gone
- 2026-10-07: 20 answered: a spec is one feature's decided plan (to-spec), tickets its build order (to-tickets); the pocket borrows the tickets shape but is not a spec. coder and verifier gain most, the designer barely. exit lines name behaviour + real commands/terms, never file paths
- 2026-10-07: renovate merged: bytes#123 motion 14, frame#62 mcp sdk 1.31 (security)
- 2026-10-07: ccrow stop is on the halt now (phase 5's last line, `ccrow:stop` after the CST); last night's was stopped at 03:20 by hand
- 2026-10-07: flowlog → pocket, shaped as matt's local tracker (grill Q1–Q6). the old vault flowlog is archived at `_hq/flowlog-archive-2026-10-07.md`

## on linear, not here

- [FRM-293](https://linear.app/x-com/issue/FRM-293): designer sharpening, chords then trophy-sys, on the four phases + ballot
- [FRM-303](https://linear.app/x-com/issue/FRM-303): mods round 5; the stash asks box parked until the mods verdict 10-19
- [FRM-324](https://linear.app/x-com/issue/FRM-324): mods rename to `x-mod-*`

## standing

- remember to ask for clarifications (dima)
- after a second ci-review round on a pr: ask «want another re-review? here is what changed» — never a third round unasked
- a rename of anything a live session uses is announced to that session the same minute
- observation: dima has too many side asks and will pick fewer; design is wanted, he has no capacity for it alone

## items

### 01 · peek matt's chief-of-staff skill
`open · research`

matt's in-progress skill (`mattpocock-skills` 1.3.1, `skills/in-progress/chief-of-staff/SKILL.md`): a long-running coordinator that works through subagents and passes context pointers. read it against cclio's own shape; name what to borrow. dima 10-07: first thing tomorrow.

### 02 · mirror the pocket into the vault, read-only
`open · task`

the pocket lives in git; dima wants it on his phone too. a symlink does not reach the phone (icloud syncs the link, not the files — inferred, untested). idea: a hook copies `pocket.md` → `_hq/pocket.md` on every write, one way. the phone copy is read-only: a phone edit there is overwritten on the next copy, so phone drops still go to the inbox (critic, 10-07). dima 10-07: «think how to have it for me too tmrw».



### 05 · x cli: a flashy but useful main view?
`open · grilling` · [FRM-284](https://linear.app/x-com/issue/FRM-284)

dima 10-07: bare `x` prints help today; he wants a dashboard-like main view (bubbletea/lipgloss) if it is useful, leans conventional for now. answer: now vs later, and what it shows. screenshot: `_hq/attachments/CleanShot 2026-10-07 at 00.01.16.jpg`.

### 06 · cheap fleet measuring
`open · research`

dima 10-07: measuring is asked often in test drives. how expensive, can haiku/sonnet measure (e.g. today's prompts)? cheap fleet stats for optimization; how to plan full fleet tracing, what first, test drive?

### 07 · retro of long coder/verifier tool-call chains
`open · research`

dima 10-07, an opener: coders run ~40 steps nonstop. read finished coder + verifier threads as evidence; name inefficiency patterns and the fix per pattern (hook, mod, cli verb, skill, memory steer). split by model and effort, cclio's own threads too. find threads by coder/verifier pair (or make that trivial). fold into a recipe; test drive? also: the recipes need organizing and a maintenance habit.

### 08 · measure the cclio boot
`open · task`

dima 10-07 (first actions): «measure cclio boot» — tokens and seconds of a boot, full and mini.

### 09 · finish the cli plan
`open · task` · [FRM-284](https://linear.app/x-com/issue/FRM-284)

dima 10-07: close yesterday's tails — the full cli plan, so a coder + verifier run while the memory sweep goes. the sweep will steer it.

### 10 · plan the memory sweep
`open · task` · [FRM-267](https://linear.app/x-com/issue/FRM-267) · blocked by 09

dima 10-07: `_hq/memory-sweep.md` holds his corrections. plan the steps first, broken into tasks, folded and ordered; then checkpoint or sweep by context size. think what goes to chore-helpers or cloud. the first real spec for the pocket.

### 11 · test drive the pocket
`open · test-drive`

two weeks from 10-07. numbers: pocket items resolved vs linear tickets opened, dima's «what's next?» asks, items lost (target 0). log in `docs/test-drive/pocket.md`. day 0 prints the baseline first: «what's next?» asks and items resolved over the last 14 days (`pnpm flow:report --days 14` + a transcript count) — a number that cannot print today cannot move in two weeks (critic, 10-07). a lost-item detector: every inbox line at the halt has a pocket section or a decision line.

### 12 · a better vpn
`open · research`

dima 09-27: hide.me not liked; test drive another later. picks: https://claude.ai/artifact/EaZ5yiNWDJK26kFz8DqzGT

### 13 · watch for stray dev servers
`open · test-drive`

the boot digest lists dev servers whose cwd is a removed worktree or a tree with no live session. 2-week vet: no stray ports from coders by 10-11 → this item dies.

### 14 · plan the model comparison bench
`open · task` · [FRM-266](https://linear.app/x-com/issue/FRM-266)

dima 09-26: after product docs, no rush. decided: 4×4 grid (opus 5.5 + fable 5.1 × low/medium/high/xhigh), 2 calibration tasks + the week's real task, blind pick in one artifact gallery, opus rubric judge as tiebreak, cost/time/tokens from transcripts, a recipe + a `bench/` home in frame. the reset button only once a window is spent, before ~10-22.

### 15 · test drive lottie / rive for atelier
`open · test-drive`

dima 10-02: test drive first (day-0 docs + users, a stress list, one real asset — a free lordicon.com icon as lottie), then a refresh-art-kit vector. not beside a running test drive.

### 16 · whiteboard test drive
`claimed · test-drive`

dev.fast whiteboard, installed, cli-driven. first case: the cli a/b/c review. research: best practices, anti-patterns, pitfalls, built products last. log: `docs/test-drive/whiteboard.md`.


### 18 · fold the x-queue into the pocket
`open · task`

dima 10-07: «fold». one fewer stash: `.claude/x-queue.md`'s «soon» lines become pocket items, its readers (boot digest, halt phase 2, `x:queue`, `habit-shared-files`) point at the pocket, then the queue file goes.


### 19 · the linear body shape that feeds a spec
`open · task`

dima 10-07 (first actions): «what should linear ticket body shape be to be optimal for being then translated to spec and to tickets? … you are an author, your audience is mostly yourself». propose the body shape + the habit (where it lives: `x:pm` field contract, `craft-pm`).



### 22 · go deps on evergreen
`open · task`

dima 10-06 opener: renovate gomod + gomodTidy; `pnpm x-go:vuln` in ci or the digest.

### 23 · gopls + staticcheck to brew
`open · task`

dima 10-06 opener: off `go install`, onto brew (install order rule).

### 24 · delve test drive
`open · test-drive`

dima 10-06 opener: `docs/test-drive/delve.md`.

### 25 · carried cleanups from 10-06
`open · task`

dima's yes 10-06: done 10-07: the 4 mod stubs trashed, worktrees `mods-round` + `agent-aeff4bdb65546b52d` removed. left: [FRM-329](https://linear.app/x-com/issue/FRM-329) stays open: dima 10-07 saw the live board, «looks not the way i want» — what he wants is still to ask. also seen: worktrees `agent-adae4efb0f50b2cba` (coder/11-stash-fold) + `FRM-305-router-v2` (coder/FRM-308-jev-budget) — status unknown, check before any word.

### 26 · test-drive verdicts due
`open · task`

adhd → extend one week (dima: «outputs was meh»); browserbase → extend to 10-14. reminders + test-drive files updated.

### 27 · guard: an obsidian subcommand with --help runs the command
`open · task`

10-07: `obsidian delete --help` deleted the active note (`_hq/memory-sweep.md`) instead of printing help; restored from `~/Library/Mobile Documents/.Trash/`. an `x-mod-guard` rule: refuse `obsidian <verb> --help` for every verb, and `obsidian delete` without an explicit file argument; the refusal points at bare `obsidian --help`. goes with the next mods round beside 17.
