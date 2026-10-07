# 🫙 pocket — cclio's local work pool

checked before linear, and emptied before linear. every inbox drop lands here as an item. linear holds the long shelf and the record; an item gets a ticket only when a coder takes it; linear work enters the order through an item that points at its ticket, so linear is never starved.

- an item: a `### NN · title` section below, its first line `status · type` (open · claimed · resolved; task · research · grilling · test-drive), then its ticket and `blocked by NN` when they exist
- what's next: the first open, unblocked, unclaimed item in «order» below. a new item takes the next number and joins «order» where it belongs, so the numbers never shift
- resolve: add one line to «decisions so far» (the file's end), then delete the item's section; the halt moves the day's decision lines into the gazette post and empties the section
- a coder-sized item gets a spec in the target repo's `.scratch/<feature>/` (`to-spec` → `to-tickets`, dima types them); the item links it

## order

30 (before the halt) · 22 → 24 → 05 → 28 → 09 → 10 → 12 → 13 → 14 → 15 → 16 → 31 → 32

## on linear, not here

- [FRM-329](https://linear.app/x-com/issue/FRM-329): the fleet board look — open, dima's want still to ask

- [FRM-293](https://linear.app/x-com/issue/FRM-293): designer sharpening, chords then trophy-sys, on the four phases + ballot
- [FRM-303](https://linear.app/x-com/issue/FRM-303): mods round 5; the stash asks box parked until the mods verdict 10-19
- [FRM-324](https://linear.app/x-com/issue/FRM-324): mods rename to `x-mod-*`

## standing

- remember to ask for clarifications (dima)
- after a second ci-review round on a pr: ask «want another re-review? here is what changed» — never a third round unasked
- a rename of anything a live session uses is announced to that session the same minute
- observation: dima has too many side asks and will pick fewer; design is wanted, he has no capacity for it alone

## items

### 05 · x cli: a flashy but useful main view?
`open · grilling` · [FRM-284](https://linear.app/x-com/issue/FRM-284)

dima 10-07: bare `x` prints help today; he wants a dashboard-like main view (bubbletea/lipgloss) if it is useful, leans conventional for now. answer: now vs later, and what it shows. screenshot: `_hq/attachments/CleanShot 2026-10-07 at 00.01.16.jpg`.

### 09 · finish the cli plan
`open · task` · [FRM-284](https://linear.app/x-com/issue/FRM-284)

dima 10-07: close yesterday's tails — the full cli plan, so a coder + verifier run while the memory sweep goes. the sweep will steer it.

planned 10-07: FRM-284 closed; four specs under FRM-14 in `.scratch/` — `x-telemetry` → `x-handoff` → `x-linear` → `x-stats-board`; decisions in `x/PRODUCT.md` «the next lane». next: the telemetry coder, spawned when the sweep session starts.

### 10 · plan the memory sweep
`open · task` · [FRM-267](https://linear.app/x-com/issue/FRM-267) · blocked by 09

sweep inputs added 10-07 (dima):
- **one name per family of files**: a recipe, its script and its shelf file share one stem (`refresh-agent-ops` ↔ `agent-ops:report` ↔ `docs/knowledge/agent-ops.md`); decide the owner of the contract (the recipe `_spec.md`, a shape-recipe skill, or an `x` check) — «everything drifts too much»
- **fold the scattered findings**: inventory `docs/research`, `docs/knowledge`, `docs/test-drive`, the recipes and the cw leaves; each finding gets one verdict: shelf, recipe, memory line, guard, or dies
- **the boot weight**: dima measured 117k at boot (memory files 81.2k) and 188k after init (+51.8k message); «is everything you preload truly useful?»
- **the usage door**: `mcp__ccd_session_mgmt__get_usage` reads plan limits + this session's context without sline (a desktop-born session has no statusline feed)
- **recipes are processes, not only research** (dima 10-07: «our recipes becomes upgraded from pure research-type to kinda process-ones … plain research only, or pre-research + followup operations … we will revamp recipes there») — `_spec.md`'s «maintenance run or execution script» split goes; a recipe may be research only, or research + follow-up operations (`refresh-agent-ops`' doors vector is the first)
first quick win (dima 10-07, yes): `_reminders.md` is 24 kB imported every turn, 29 of 41 lines are test-drive verdicts copied three times — verdict dates live only in each test-drive file, the boot prints the ones due in 2 days, reminders keep real date/condition hooks only.

dima 10-07: `_hq/memory-sweep.md` holds his corrections. plan the steps first, broken into tasks, folded and ordered; then checkpoint or sweep by context size. think what goes to chore-helpers or cloud. the first real spec for the pocket.

planned 10-07: `.scratch/memory-sweep/` — the spec + nine phase tickets (01 baseline + audit → 09 global review); the grill log in `docs/test-drive/memory-sweep.md`. next: a fresh session runs 01.

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

### 22 · go deps on evergreen
`open · task`

dima 10-06 opener: renovate gomod + gomodTidy; `pnpm x-go:vuln` in ci or the digest.

### 24 · delve test drive
`open · test-drive`

dima 10-06 opener: `docs/test-drive/delve.md`.

### 28 · finish the handoffs port, then make «done» mean migrated
`open · task` · [FRM-338](https://linear.app/x-com/issue/FRM-338) · [FRM-284](https://linear.app/x-com/issue/FRM-284)

10-07: `x handoffs` (list, peek, ingest) has zero callers; `x:handoff`, `x:handoff-ingest` and raycast `x-ray` still call `script/skill-handoff-store.ts`. port write + delete, switch every caller, the script dies in the same commit. the rename `handoffs` → `handoff` already sits in FRM-338. dima 10-07: «creating dead cli families and verbs is not about optimization» — the migration rule rides the cli plan (09).

### 30 · before the halt: dima types /mattpocock-skills:retro in this thread
`open · task`

dima 10-07: «yes remind me». run before the CST, in the session it looks back on (matt: «run /retro in the session it's looking back on, before you clear»). material: the obsidian near-miss, three guessed 📄 stamps, two ccrow catches, inline coding instead of delegating. one log line in `docs/test-drive/retro.md`.

### 31 · price a skill eval before running one
`open · test-drive` · parked until the budget allows (dima 10-07: «maybe if i get a $200 anthropic plan»)

`claude plugin eval` runs each case as a full session; 10 cases × 3 runs × 2 arms = 60 sessions. first step: one `x:cmt` case («commit this» in a temp repo), one run, `--max-cost-usd 1`, read the printed cost. tiers to decide then: the plugin alone (cheap, does the skill fire on its own phrasing) vs the full fleet context (the truth, the real competition between skills). source: `docs/knowledge/agent-ops.md`.

### 32 · govulncheck in the boot digest
`open · task`

dima 10-07: the digest, not CI. one line in `boot-prefetch.sh`: `pnpm x-go:vuln`, informational, a red names the module.

### 33 · shape the squad leader
`open · grilling` · blocked by 10

dima 10-07: «instead of spawning a coder you spawn a squad leader (e.g., a coordinator). It is a mini coordinator … it essentially manages a coder and a verifier with the given task by you. It handles communication between the coder and verifier and only reports to you with positive results, issues and disputes, or design questions that I would be interested to answer. This way your thread will be filtered out of the noise». the sweep (ticket 05) cuts `craft-spawning` by trigger first; the squad leader is shaped with `x:shape-idea` from what that cut leaves.

## decisions so far

- 2026-10-07: 02 the pocket mirrors to `_hq/pocket.md` after every cclio turn (a Stop hook, `cclio/.claude/hooks/pocket-mirror.sh`, one-way, a read-only banner on top, copies only on a change)
- 2026-10-07: 27 guard: `obsidian <verb> --help` and a target-less `obsidian delete` are refused (x-mod-guard, 2 tests, proven red)
- 2026-10-07: 01 matt's chief-of-staff (27 lines, in-progress) is cclio's own shape; two borrows proposed: context pointers in every brief, delegate edits by default
- 2026-10-07: 18 x-queue folded: cclio's `/queue` lines become pocket items; boot digest, boot + halt skills, README, the snapshot script and habit-shared-files repointed; the empty queue file trashed (cclio 0.3.107)
- 2026-10-07: 25 done: 4 mod stubs trashed, 3 merged worktrees removed; `FRM-305-router-v2` kept until the jev refill ~10-18; [FRM-329](https://linear.app/x-com/issue/FRM-329) stays open (dima: the board look is not what he wants yet)
- 2026-10-07: 11 pocket test drive started, to 10-21: baseline in `docs/test-drive/pocket.md` (linear 103 created / 97 closed in 14 days), a reminder, the habit list
- 2026-10-07: 26 adhd and browserbase verdicts moved to 10-14 (reminders, test-drive files, habit list)
- 2026-10-07: bytes main checkout back on main (off the dead cloud/knip-sweep), 2 unpushed 10-06 commits rebased on origin, motion 14: trophy-sys builds
- 2026-10-07: 17 fixed: the stash asks list keeps only sessions the registry has alive, this session always (2 tests, both proven red); live: the dead cclio `91f2a33c`'s 6 asks drop at the next reload
- 2026-10-07: 19 + 21 resolved in one thread: the linear body is the spec seed (want · why · stories · proposed · decided · open · exit · out · refs), the boundary is in time (linear until dispatch, the spec owns the run, the outcome folds back); dima's flow plan wide → pre-grill → to-spec → to-tickets → dispatch is spec-pipeline run 2, first case the cli plan, to-spec'd live with dima to judge whether the spec lives in linear; user-only skills are run by reading their SKILL.md; tickets stay local (`.scratch/`, gitignored in frame, missing in bytes), die on merge; issue filed: [claude-code#100193](https://github.com/anthropics/claude-code/issues/100193)
- 2026-10-07: 03 no refs to protected.md anywhere. 04 bun = [FRM-148](https://linear.app/x-com/issue/FRM-148), oxlint = [BYT-38](https://linear.app/x-com/issue/BYT-38), both in monorepo m3 «the tool picks», roadmap step 9; `_hq/dima-roadmap.md` deleted via `obsidian delete path=` into the trash, its two memory mentions gone
- 2026-10-07: 20 answered: a spec is one feature's decided plan (to-spec), tickets its build order (to-tickets); the pocket borrows the tickets shape but is not a spec. coder and verifier gain most, the designer barely. exit lines name behaviour + real commands/terms, never file paths
- 2026-10-07: renovate merged: bytes#123 motion 14, frame#62 mcp sdk 1.31 (security)
- 2026-10-07: ccrow stop is on the halt now (phase 5's last line, `ccrow:stop` after the CST); last night's was stopped at 03:20 by hand
- 2026-10-07: flowlog → pocket, shaped as matt's local tracker (grill Q1–Q6). the old vault flowlog is archived at `_hq/flowlog-archive-2026-10-07.md`
- 2026-10-07: 23 gopls + staticcheck come from brew now (go1.27.1 builds, first on PATH); the `go install` copies are in the trash; Brewfile + `x:guide-go` updated
- 2026-10-07: 07 retargeted: chain length is the wrong target (3 lanes); the five activities and the numbers live in `docs/knowledge/agent-ops.md`, refreshed by `cclio/docs/recipes/refresh-agent-ops.md` (on a test drive)
- 2026-10-07: 06 + 29 + 08 one measuring pass: `pnpm agent-ops:report` (0 model tokens): cost per ticket median 30.0M tokens / 30 min over 23 tickets; cclio code edits up to 18 in one session; boot full 1.8M tokens / 61 s, mini 1.2M / 43 s (n=1 each, tokens mostly cache reads)
