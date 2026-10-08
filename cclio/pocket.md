# 🫙 pocket — cclio's local work pool

checked before linear, and emptied before linear. every inbox drop lands here as an item. linear holds the long shelf and the record; an item gets a ticket only when a coder takes it; linear work enters the order through an item that points at its ticket, so linear is never starved.

- an item: a `### NN · title` section below, its first line `status · type` (open · claimed · resolved; task · research · grilling · test-drive), then its ticket and `blocked by NN` when they exist
- what's next: the first open, unblocked, unclaimed item in «order» below. a new item takes the next number and joins «order» where it belongs, so the numbers never shift
- resolve: add one line to «decisions so far» (the file's end), then delete the item's section; the halt moves the day's decision lines into the gazette post and empties the section
- a coder-sized item gets a spec in the target repo's `.scratch/<feature>/` (`to-spec` → `to-tickets`, dima types them); the item links it

## order

09 (the cli grill, census ready) → 49 (refresh-adviser run, lanes in) → 45 → 39 → 38 → 40 → 42 → 43 → 44 → 05 → 10 → 36 → 37 → 35 (the gate is not open) → 30 (before the halt) → 22 → 24 → 12 → 13 → 14 → 15 → 16 → 31 → 32

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

- wisp, 10-08: `x stats` prints the span it really covers (the go trace store starts 10-07) and excludes `-dirty` builds unless `--dev`; 2,235 lines = 2 days, 640 from dirty binaries, the 10-07 hook burst a dev loop. estimate 1, rides the cli lane after its grill (dima)

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

dima 10-07: `_hq/memory-sweep.md` holds his corrections. plan the steps first, broken into tasks, folded and ordered; then checkpoint or sweep by context size. think what goes to choress or cloud. the first real spec for the pocket.

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

### 30 · before the halt: dima types /mattpocock-skills:retro in this thread
`open · task`

dima 10-07: «yes remind me». run before the CST, in the session it looks back on (matt: «run /retro in the session it's looking back on, before you clear»). material: the obsidian near-miss, three guessed 📄 stamps, two ccrow catches, inline coding instead of delegating. one log line in `docs/test-drive/retro.md`.
- 10-07 ran as a ccrow retro (`.scratch/cclio-retro/2026-10-07-ccrow.md`); dima: «so ccrow's retro is also useful? … i want to gather retro from ccrow myself next time. remind to do that before next halt. and print full path to retro skill because ccrow does not have that in slash commands for some reason.» → before the next halt, cclio reminds him; he types in ccrow's window: «read /Users/dima/.claude/plugins/cache/mattpocock/mattpocock-skills/1.3.1/skills/engineering/retro/SKILL.md and run it over cclio's session from your packets; focus: <his steer>» (the version dir moves on a plugin update: `ls ~/.claude/plugins/cache/mattpocock/mattpocock-skills/`)
- cclio runs its own retro beside it, from its own context — two views, one flush

### 31 · price a skill eval before running one
`open · test-drive` · parked until the budget allows (dima 10-07: «maybe if i get a $200 anthropic plan»)

`claude plugin eval` runs each case as a full session; 10 cases × 3 runs × 2 arms = 60 sessions. first step: one `x:cmt` case («commit this» in a temp repo), one run, `--max-cost-usd 1`, read the printed cost. tiers to decide then: the plugin alone (cheap, does the skill fire on its own phrasing) vs the full fleet context (the truth, the real competition between skills). source: `docs/knowledge/agent-ops.md`.

### 32 · govulncheck in the boot digest
`open · task`

dima 10-07: the digest, not CI. one line in `boot-prefetch.sh`: `pnpm x-go:vuln`, informational, a red names the module.

### 34 · the spec ↔ linear body relation, from the archive
`open · parked` · after enough spec runs

dima 10-07: «do not delete specs we create, but move them into an archive somewhere, maybe in scratch. After some time, when we run enough specs and have an updated comparison, we would just open the archive, see what kind of specs we have, and see how to apply it to linear (e.g., move specs into linear from scratch, or just keep specs local or something). E.g., solve the linear ticket body/specs body relation question.» the archive is `.scratch/_archive/<feature>/` (`docs/agents/issue-tracker.md`).

### 33 · shape the squad leader
`open · grilling` · blocked by 10

dima 10-08 13:22: the crew-coordinator as part of a squad (an independent `--bg` session outside cclio) is to be a/b test-driven.

dima 10-07: «instead of spawning a coder you spawn a squad leader (e.g., a coordinator). It is a mini coordinator … it essentially manages a coder and a verifier with the given task by you. It handles communication between the coder and verifier and only reports to you with positive results, issues and disputes, or design questions that I would be interested to answer. This way your thread will be filtered out of the noise». the sweep (ticket 05) cuts `craft-spawning` by trigger first; the squad leader is shaped with `x:shape-idea` from what that cut leaves. its skill name: `x:crew-lead` (dima 10-07 ✓, beside `crew-coder` / `crew-verifier`).

### 35 · purge the plaintext job-market recipe from frame's history
`open · waiting on github` · history purged 10-07 23:05, support ticket filed 23:15

- done 10-07: filter-repo --sensitive-data-removal on d1bddfb5^..main, 20 commits re-signed, recipe re-added encrypted, force-pushed main (c84402be → f3fc8352; protection opened by dima, restored to no-force), github virtual-assistant ticket filed: remove the commit references of #65, the cached views of d1bddfb5 ae681204 668962e4 32c12a41 ff1aeeb2 c636f2cf
- left: github's «cleared» mail → `gh api repos/dvakatsiienko/frame/commits/d1bddfb5` answers 404 → trash the backup bundle `/private/tmp/claude-501/-Users-dima-frame-cclio/199ac617-3e2a-4366-b624-e67c8b7578d2/scratchpad/purge/frame-pre-purge.bundle` (it holds the plaintext; /tmp may clear it first, which is fine)

the recipes move (d1bddfb5, 10-07) left `recipes/refresh-job-market/recipe.md` unencrypted in the public repo: his target companies, the miltech branch in his words, a cv path with his email. re-encrypted at 3a310e81; history still holds the plaintext. dima 10-07: «yes» to filter-repo + force-push main after #65 merges.
- steps: every coder pr merged or rebased-ready; `git filter-repo --path recipes/refresh-job-market --invert-paths` scoped to the plaintext commits only (the encrypted ones stay), or re-encrypt in place across history; force-push main (his word, named); every worktree and clone re-synced (`git worktree list`, `.claude/worktrees/`)
- a force-push does not delete the blob from github: the old commits stay fetchable by sha and in cached pr/compare views until github support removes them (ccrow, 10-07 — read github's «removing sensitive data» doc before the run) → a support request naming d1bddfb5 and the commits after it that still carry the plaintext
- done: `git log --all -p -- recipes/refresh-job-market` shows only GITCRYPT blobs, and github's support ticket is filed

### 36 · ccrow's packet diet
`open · approved` · tomorrow, after ccrow's own opinion

ccrow's session read 625k chars on 10-07, ~all of it 22 `packets/<wake>/delta.md` files (30–63k each). dima 10-07: «the delta packet drops tool output ← let's try. but let's measure. ask ccrow herself if she wants it?» · «ccrow should survive your checkpoints, unless it grewen big» · on cold cache: «i sometimes go away from kb for ~30 mins, and crow can reach cold cache silently».
- measure first: the tool_result share of a delta packet (one `jq` over today's packets)
- then: the packet keeps dima's messages whole (`<command-args>` included), cclio's replies and peer messages whole, task-notification results capped at ~2k chars with the output_file path, tool-call names; tool_result bodies go. a/b one day of notes against today's
- ccrow 10-07, asked: «yes, drop the tool_result bodies — none of today's catches used them»; the real loss was the 60000-char cut losing dima's lines at a packet's head, a slimmer packet fixes it; she writes each watch item into the note text so a halt restart drops nothing; a cold-cache guard is a keep-hot ping at ~50 min idle, default off, never a skipped wake
- cold cache, measured 10-07: only the 09:20 start wrote cold; the 48-min pause stayed warm (1h ttl on a main session, per the refresh-coordinator researcher lane). a gap over 1h goes cold silently — a guard is ccrow's call

### 37 · the roster marks dima's own sessions
`open · task` · a second sighting (10-07)

cclio twice proposed stopping a remote-control session dima had started himself that day (pid 69787, the night flawlog had already named it). the boot's fleet roster marks a session dima created (desktop-born or remote-control, born today, not in cclio's spawn list) as his, and the halt's stop list never names it.

### 38 · the 5h window trick — an autokicker or a 1-click prestarter
`open · research` · inbox 10-08, 🐦‍⬛ first actions

dima: the 5h window starts on the first token spent, so when he boots me the window opens and our token plan spreads over those 5h. but if at boot the window is already at, say, 2:30, we can code more densely in the shorter window. how to set up a 5h autokicker properly? a tiny probe that sends 1 token to claude.ai so the window is always moving, and he starts at any time but always with less than 5h? alternative: a 1-click door to a 5h prestarter — he roughly plans when he boots me and opens the window 1–2 h before. must: 1. good ux · 2. preferably works on his mobiles · 3. preferably 1-click · 4. maybe a complementary useful feature or two · 5. ideally pretty. «search and propose».

### 39 · weekly usage window — spend it fully, non-stop lanes, the 5h catch
`open · grilling` · inbox 10-08, 🛹 steering, this session

dima: we went overboard, he is at 69 %. two ways: economic mode, or push to spend the full weekly window and apply his weekly-reset option — he leans to the latter. spend efficiently: going overboard is not waste; spend as much as possible on the most needed stuff. plan and grill lanes so they work non-stop; review the night-shift lanes; what can i batch-do that needs little of his attention? the catch is the 5h window: keep an eye on it so he is never stuck at 95 % with the reset 3h away. boot line 10-08: pace it as a permanent habit; from the desktop the door is `get_usage`, from a terminal sline's window measures; over the line → pause parallel lanes without letting their cache cool, resume when it loosens; attention and wellbeing first, output volume after.

### 40 · «wishes» — he likes the name he invented
`open · task` · inbox 10-08, 👀 fyi

dima: he liked the «wishes» name. 13:22: «i actually meant a possible new name for the bytes repo» — a rename candidate for the monorepo, decided at the merge (m1–m4), not before; a name grill then.


### 42 · matt's retros — how they are collected, the steer, the cost
`open · research` · inbox 10-08, 🙋‍♂️ question

dima: how do i collect retros from the coder, the verifier and myself, via him? since they are steerable, we could gain more if they are targeted: do i simply ask the coder and verifier for a «retro», or steered? what should the coder, verifier and ccrow retro about — the steer vector? for my own retro he will pick each steer himself. also: the cost of the retro skill — it reads thread transcripts, is it costlier than our previous matt-skill-less retros? remind how matt's retro skill works.

### 43 · yesterday's ctx jump — why ~700k, and cloud agents for research
`open · research` · inbox 10-08, 🙋‍♂️ question

dima: when i rushed the refresh-spawning-mechanics research, i said it cost ~700k. why? how can a research cost that much? can i use cloud agents for research? if yes, what is the easiest data transfer — a prompt → a pr that merges the research results into frame/main → i pull → research by hand?

### 44 · weekly window at 68 % — what ops could go to the cloud
`open · research` · inbox 10-08, 🙋‍♂️ question · beside 39 and 43

dima: he is at 68 % — what ops could i delegate to cloud agents?

### 45 · recipes revamp — the right shape for any produce, as global memory
`open · grilling` · inbox 10-08, 🙋‍♂️ question

dima: yesterday we added a «log» for recipes, but he spotted a log (cannot recall which) that was too bloated, told me to check, and i confirmed. how to translate that into global memory so any agent tries to pick the right shape for any produce — a log, a report, a stats report, anything — so «wrong» shapes (too large, too small) appear less often?




### 49 · ccrow is underutilized — the adviser vector in the coordinator recipe
`open · task` · inbox 10-08, 🐞 · dima 13:54: the `refresh-coordinator` rerun runs its source lane as a **cloud agent** (`x:crew-cloud`, branch transfer) head-to-head with the opus `researcher`, graded in `docs/test-drive/cc-cloud.md` — after the step-0 groom and his review (48)

dima: add a research vector to the coordinator recipe to hunt solid adviser-model behaviour — what would a good adviser model want to do to be a very good adviser? what do i, as coordinator, pm and cto, want from an adviser model? consider the crow taxonomy and the ctx budget; do not ask it to code — coding is disapproved, not banned; it can explore at least. enable his mod for crow and enable the retro recipe. when the recipe is updated, run it, and propose a good update for the adviser model — consult the adviser model itself, ask his question and mine. what to search for: how to build a good adviser model, the best model fit (opus? fable?), the baseline effort.



### 52 · the 5h prestarter kit — ios shortcut, raycast kick, a scheduled kickoff
`standing · task` (his word 13:05: stays until he tried every door and picked one) · dima 10-08, from 38 · research: `scratchpad/research-5h-window.md` (this session's scratch; the facts are in the exa/parallel/researcher logs)

dima: «let's try shortcut and ray cmd. i also want a way to set a scheduled 5h kickoff or a routine. for example: i plan to start you at 1 pm; i wake up at 9 and set a scheduled 5h kickoff at 11 am. how to do that the easiest way?»
- his hands: an ios shortcut on the «Ask Claude» app intent, prompt «ok», home screen on iphone + ipad, ending with a «window opened · resets» notification; the probe tomorrow morning (tap with no claude use in 5 h, boot, read the digest's 5h reset)
- a coder freebie: a raycast script command in x-ray running `claude -p --model haiku` with no tools and a replaced system prompt (not `--bare`); a «kick at HH:MM» variant via a one-shot launchd job + `pmset schedule wake`
- the scheduled kickoff: candidates — an ios automation on an alarm trigger (set the alarm = set the time; runs locked? «?»), a one-off cloud routine set from the phone (whole cloud session per kick), the mac one-shot above. one probe each before a pick

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
- 2026-10-07: 07 retargeted: chain length is the wrong target (3 lanes); the five activities and the numbers live in `docs/knowledge/agent-ops.md`, refreshed by `recipes/refresh-agent-ops/recipe.md` (on a test drive)
- 2026-10-07: 06 + 29 + 08 one measuring pass: `pnpm agent-ops:report` (0 model tokens): cost per ticket median 30.0M tokens / 30 min over 23 tickets; cclio code edits up to 18 in one session; boot full 1.8M tokens / 61 s, mini 1.2M / 43 s (n=1 each, tokens mostly cache reads)
- 2026-10-07: 28 resolved — `x handoff` owns the whole store, every caller moved, the node script died ([FRM-343](https://linear.app/x-com/issue/FRM-343), frame#64)
- 2026-10-08: 46 answered — «wishes» works; the drift he named is real, the fold rule landed in craft-pm, dima-signals, fleet-vibe
- 2026-10-08: 50 the handpicked wishes header is now the inbox template's section (todos → wishes)
- 2026-10-08: 47 «gremlins» → «wisps» on every surface (4 linear stash tickets, craft-pm, the inbox template + live inbox section); dima: small glowing things to tend, not enemies
- 2026-10-08: 41 ccrow runs opus 5.5 medium (the day arm); dima: one fable is enough
- 2026-10-08: 46 answered — wishes works; the fold rule landed (craft-pm, dima-signals, fleet-vibe), 🌠 wish + ✨ wisp badges, bold fleet words fleet-wide
- 2026-10-08: 48 landed — invariant 10 in root CLAUDE.md, the checkup card (cclio-only), siesta replaces pit stop, the subagents named + badged in fleet-identity (helper, researcher, retro, Explore, checkup), the cli verdict: useful for the fleet (lane commit/push), 8 hand calls by dima; the «is the cli useful» question folds into the cli grill (09)
- 2026-10-08: 51 landed — one wish, one home at a time; a spec points at its wish; wishes checked at fold time; old verbatims re-folded on touch
