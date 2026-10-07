# 🫙 pocket — cclio's local work pool

checked before linear, and emptied before linear. every inbox drop lands here as an item. linear holds the long shelf and the record; an item gets a ticket only when a coder takes it; linear work enters the order through an item that points at its ticket, so linear is never starved.

- an item: a `### NN · title` section below, its first line `status · type` (open · claimed · resolved; task · research · grilling · test-drive), then its ticket and `blocked by NN` when they exist
- what's next: the first open, unblocked, unclaimed item in «order» below. a new item takes the next number and joins «order» where it belongs, so the numbers never shift
- resolve: add one line to «decisions so far», then delete the item's section
- a coder-sized item gets a spec in the target repo's `.scratch/<feature>/` (`to-spec` → `to-tickets`, dima types them); the item links it

## order

01 → 02 → 07 → 03 → 04 → 08 → 09 → 10 → 05 → 06 → 11 → 12 → 13 → 14 → 15 → 16 → 17

## decisions so far

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

### 03 · clear refs to the deleted protected.md
`open · task`

dima deleted `_hq/protected.md` (unused). grep the fleet for it, drop each line. freebie.

### 04 · place bun + oxlint on the roadmap, drop dima-roadmap.md
`open · task`

dima 10-07: «where bun and oxlint are in our roadmap?» · the linear initiative is the roadmap; `_hq/dima-roadmap.md` is not needed by him — delete it if cclio does not need it either (his word given). check refs first.

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

### 17 · stash shows another session's stale asks
`open · task` · [FRM-303](https://linear.app/x-com/issue/FRM-303)

dima 10-07: the asks box listed yesterday's 6 asks under «cclio · frame» while the live `cclio_` session (born today, no open asks) sat beside this one. guess: a dead session's key stays in the store, or the asks get matched to a live session by name. read `x-mod-stash/hooks/register.tsx` (asks, one key per session) before a fix. a gremlin, so it goes first in the next mods round.

