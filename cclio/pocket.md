# 🫙 pocket — cclio's local work pool

> 🧊 **FROZEN since 2026-10-09 13:42 — the a/b trial runs in Backlog.md** (`cclio/backlog/`, `backlog task list --plain`). every item here lives there as `pk-N`, its pocket number in the title. no writes here until the trial's verdict; a new item goes to backlog only.

checked before linear, and emptied before linear. every inbox drop lands here as an item. linear holds the long shelf and the record; an item gets a ticket only when a coder takes it; linear work enters the order through an item that points at its ticket, so linear is never starved.

- an item: a `### NN · title` section below, its first line `status · type` (open · claimed · resolved; task · research · grilling · test-drive), then its ticket and `blocked by NN` when they exist
- what's next: the first open, unblocked, unclaimed item in «order» below. a new item takes the next number and joins «order» where it belongs, so the numbers never shift
- resolve: add one line to «decisions so far» (the file's end), then delete the item's section; the halt moves the day's decision lines into the gazette post and empties the section
- a coder-sized item gets a spec in the target repo's `.scratch/<feature>/` (`to-spec` → `to-tickets`, dima types them); the item links it

## order

62 (retros + skills only grow — inbox 🐦‍⬛ first action) → 64 (exit lines, an answer) → 58 (lane tracker mod, shape first) → 59 (threshold input) → 61 (reset waker, mods lane) → 60 (global memory easy wins) → 69 (memory-arch idea, beside 60) → 10 (the sweep, nurture-memory first) → 63 (crew-coder groom — right after nurture-memory, dima 10-09 steering) → 66 (recipes as a product) → 65 (refresh-guide-go + charm) → 67 (`x recipe` verb, after 66) → 68 (signed handoff) → 49 (adviser run 2 round 3) → 33 (shape `x:crew-lead`) → 39 → 05 → 36 → 37 → 30 (before the halt) → 53 → 56 → 24 → 12 → 13 → 14 → 15 → 16 → 31

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

### 34 · the spec ↔ linear body relation, from the archive
`open · parked` · after enough spec runs

dima 10-07: «do not delete specs we create, but move them into an archive somewhere, maybe in scratch. After some time, when we run enough specs and have an updated comparison, we would just open the archive, see what kind of specs we have, and see how to apply it to linear (e.g., move specs into linear from scratch, or just keep specs local or something). E.g., solve the linear ticket body/specs body relation question.» the archive is `.scratch/_archive/<feature>/` (`docs/agents/issue-tracker.md`).

### 33 · shape the squad leader
`open · grilling` · pulled ahead of 10 (dima 10-08: «plan your coordination module split earlier … prioritize the planning»); the 10-07 estimate: `craft-spawning` keeps a ~5k core, the brief lessons move to `x:crew-lead`, ~19k tokens off every cclio turn

dima 10-08 13:22: the crew-coordinator as part of a squad (an independent `--bg` session outside cclio) is to be a/b test-driven.

dima 10-07: «instead of spawning a coder you spawn a squad leader (e.g., a coordinator). It is a mini coordinator … it essentially manages a coder and a verifier with the given task by you. It handles communication between the coder and verifier and only reports to you with positive results, issues and disputes, or design questions that I would be interested to answer. This way your thread will be filtered out of the noise». the sweep (ticket 05) cuts `craft-spawning` by trigger first; the squad leader is shaped with `x:shape-idea` from what that cut leaves. its skill name: `x:crew-lead` (dima 10-07 ✓, beside `crew-coder` / `crew-verifier`).

### 36 · ccrow's packet diet
`open · approved` · tomorrow, after ccrow's own opinion

ccrow's session read 625k chars on 10-07, ~all of it 22 `packets/<wake>/delta.md` files (30–63k each). dima 10-07: «the delta packet drops tool output ← let's try. but let's measure. ask ccrow herself if she wants it?» · «ccrow should survive your checkpoints, unless it grewen big» · on cold cache: «i sometimes go away from kb for ~30 mins, and crow can reach cold cache silently».
- measure first: the tool_result share of a delta packet (one `jq` over today's packets)
- then: the packet keeps dima's messages whole (`<command-args>` included), cclio's replies and peer messages whole, task-notification results capped at ~2k chars with the output_file path, tool-call names; tool_result bodies go. a/b one day of notes against today's
- ccrow 10-07, asked: «yes, drop the tool_result bodies — none of today's catches used them»; the real loss was the 60000-char cut losing dima's lines at a packet's head, a slimmer packet fixes it; she writes each watch item into the note text so a halt restart drops nothing; a cold-cache guard is a keep-hot ping at ~50 min idle, default off, never a skipped wake
- cold cache, measured 10-07: only the 09:20 start wrote cold; the 48-min pause stayed warm (1h ttl on a main session, per the refresh-crew-coordinator researcher lane). a gap over 1h goes cold silently — a guard is ccrow's call

### 37 · the roster marks dima's own sessions
`open · task` · a second sighting (10-07)

cclio twice proposed stopping a remote-control session dima had started himself that day (pid 69787, the night flawlog had already named it). the boot's fleet roster marks a session dima created (desktop-born or remote-control, born today, not in cclio's spawn list) as his, and the halt's stop list never names it.

### 39 · weekly usage window — spend it fully, non-stop lanes, the 5h catch
`open · grilling` · inbox 10-08, 🛹 steering, this session

dima: we went overboard, he is at 69 %. two ways: economic mode, or push to spend the full weekly window and apply his weekly-reset option — he leans to the latter. spend efficiently: going overboard is not waste; spend as much as possible on the most needed stuff. plan and grill lanes so they work non-stop; review the night-shift lanes; what can i batch-do that needs little of his attention? the catch is the 5h window: keep an eye on it so he is never stuck at 95 % with the reset 3h away. boot line 10-08: pace it as a permanent habit; from the desktop the door is `get_usage`, from a terminal sline's window measures; over the line → pause parallel lanes without letting their cache cool, resume when it loosens; attention and wellbeing first, output volume after.
- merged from 43 (dima, 2026-10-09):
  `open · research` · inbox 10-08, 🙋‍♂️ question

  dima: when i rushed the refresh-spawning-mechanics research, i said it cost ~700k. why? how can a research cost that much? can i use cloud agents for research? if yes, what is the easiest data transfer — a prompt → a pr that merges the research results into frame/main → i pull → research by hand?
- merged from 44 (dima, 2026-10-09):
  `open · research` · inbox 10-08, 🙋‍♂️ question · beside 39 and 43

  dima: he is at 68 % — what ops could i delegate to cloud agents?

### 49 · ccrow is underutilized — the adviser vector in the coordinator recipe
`open · task` · inbox 10-08, 🐞 · dima 13:54: the `refresh-crew-coordinator` rerun runs its source lane as a **cloud agent** (`x:crew-cloud`, branch transfer) head-to-head with the opus `researcher`, graded in `docs/test-drive/cc-cloud.md` — after the step-0 groom and his review (48)

dima: add a research vector to the coordinator recipe to hunt solid adviser-model behaviour — what would a good adviser model want to do to be a very good adviser? what do i, as coordinator, pm and cto, want from an adviser model? consider the crow taxonomy and the ctx budget; do not ask it to code — coding is disapproved, not banned; it can explore at least. enable his mod for crow and enable the retro recipe. when the recipe is updated, run it, and propose a good update for the adviser model — consult the adviser model itself, ask his question and mine. what to search for: how to build a good adviser model, the best model fit (opus? fable?), the baseline effort.



### 52 · the 5h prestarter kit — ios shortcut, raycast kick, a scheduled kickoff
`standing · task` (his word 13:05: stays until he tried every door and picked one) · dima 10-08, from 38 · research: `scratchpad/research-5h-window.md` (this session's scratch; the facts are in the exa/parallel/researcher logs)

dima: «let's try shortcut and ray cmd. i also want a way to set a scheduled 5h kickoff or a routine. for example: i plan to start you at 1 pm; i wake up at 9 and set a scheduled 5h kickoff at 11 am. how to do that the easiest way?»
- his hands: an ios shortcut on the «Ask Claude» app intent, prompt «ok», home screen on iphone + ipad, ending with a «window opened · resets» notification; the probe tomorrow morning (tap with no claude use in 5 h, boot, read the digest's 5h reset)
- a coder freebie: a raycast script command in x-ray running `claude -p --model haiku` with no tools and a replaced system prompt (not `--bare`); a «kick at HH:MM» variant via a one-shot launchd job + `pmset schedule wake`
- the scheduled kickoff: candidates — an ios automation on an alarm trigger (set the alarm = set the time; runs locked? «?»), a one-off cloud routine set from the phone (whole cloud session per kick), the mac one-shot above. one probe each before a pick
- merged from 38 (dima, 2026-10-09):
  `open · research` · inbox 10-08, 🐦‍⬛ first actions

  dima: the 5h window starts on the first token spent, so when he boots me the window opens and our token plan spreads over those 5h. but if at boot the window is already at, say, 2:30, we can code more densely in the shorter window. how to set up a 5h autokicker properly? a tiny probe that sends 1 token to claude.ai so the window is always moving, and he starts at any time but always with less than 5h? alternative: a 1-click door to a 5h prestarter — he roughly plans when he boots me and opens the window 1–2 h before. must: 1. good ux · 2. preferably works on his mobiles · 3. preferably 1-click · 4. maybe a complementary useful feature or two · 5. ideally pretty. «search and propose».

### 53 · sonnet 5.5 as a coder, one quick-lane ticket
open · test-drive
- dima's yes, 2026-10-08: the next quick-lane ticket spawns `--model sonnet --effort medium` instead of opus; graded against an opus coder on the same lane shape (steps, cost, `#brief` lines, rounds). a fresh `docs/test-drive/sonnet-coder.md` on day 0
- why: sonnet 5.5 beats opus 5.5 on Terminal-Bench 4.0 (70.6 vs 66.4); anthropic still calls opus stronger on open-ended work

### 56 · count bare fleet words in cclio's replies, mod it if it grows
open · test-drive
- dima, 2026-10-08: «pocket it and count error occurrences, if it grows — mod it». the miss: «that becomes a wisp» printed plain, where the rule says **✨ wisp**, bold with its badge
- the count: at each halt, 🪶 sifter counts this session's replies that print `wisp`, `wish`, `siesta` or `freebie` without the bold + badge (`lane` is left out — too common as a plain word, false positives). one line per halt in `docs/test-drive/reply-check.md`
- 17:51 dima approved the autofix instead: x-mod-stash bolds + badges a bare fleet word pre-render (sent to the mods coder). the halt count now reads the fixer's own hit counter — a hit is a miss of mine it caught. shipped 18:14 (mods coder, live-proven): hits live in x-mod-stash's store under `words:<yyyy-mm-dd>:<sid>`

### 58 · a live lane tracker in the fleet board
open · idea · shape-idea first
- dima, 2026-10-08 (screenshot, the board's empty lower half): «i often ask you to tell me where we are … how could i see that plan live via a mod, maybe in the board area, because it has a lot of wasted space?»
- what it shows: now · next · then — the thread's lane (researching the adviser → cli groom → night-shift grill), one line each, plus the 🔭 waits
- two sources, a grill picks one: the pocket's «order» plus a `now:` line cclio keeps · or a `📍 now:` line in cclio's replies, which x-mod-stash already parses (it reads the ⏳ block today), so no new file
- owner: x-mod-stash's board (the mods coder); FRM-349 kept the board in stash, so this is its home
- dima, 2026-10-09 (screenshot, the board's empty lower half): «what I wanted is a live list of a lane with checkboxes (ordered tasks, organized by lane if several lanes run at once), so I could see a kind of progress live.» the `📍 now:` reply line was «naive, it will display poorly». a file the mod reads from has to exist, but never a stray one: it serves several purposes at once — cclio's live progress log during a lane (the one planned before) and the board's render. «a bigger thing to plan» → a granular grill tomorrow, then a ticket

### 59 · a live autocompact threshold input in the stash pane
open · idea · grill first, no build before the grill
- dima, 2026-10-08: «something like a number input that i can edit live — a compaction threshold». context: cclio's `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` in `cclio/.claude/settings.json` takes effect live (a 45 % probe compacted cclio one turn later, 20:43); set to 70 at 21:25
- shows: context % against the threshold; a compaction fired → when, from what % to what %
- open: does a stash band write settings.json (a shared, hand-kept file), or a stash-owned env file? per session or cclio-only?
- grill 10-09, Q7 accepted by silence: it writes the current session's project `.claude/settings.local.json`, never user settings

### 60 · global memory easy wins, every member loads them
open · task · planned ahead of the sweep (dima, 2026-10-08)
- from cclio's 10-07 20:29 answer: `fleet-hazards` lines whose `x-mod-guard` rule exists die (~3–4k chars); `fleet-tooling` cc-only trial lines (duckdb, ctx7) move to their test-drive files (~2k); frame `AGENTS.md` launchd + tcc hazards move to `schedule/AGENTS.md` (~3k). ~8–9k chars, ~3k tokens per session for every member
- `rules/` and frame `AGENTS.md` edits need dima's word before the edit

## decisions so far

- 2026-10-09: 35 done: all 6 purged shas answer 422 «no commit found» on github; the backup bundle is already gone with its /tmp scratch
- 2026-10-09: 40 «wishes» as a bytes name lands in [BYT-60](https://linear.app/x-com/issue/BYT-60) (rename bytes), decided at the merge with a name grill

### 61 · the 5h reset waker, behind a global switch
open · grilled 10-09 · ticket under FRM-304 at the next mods lane
- dima, 2026-10-09: the `--bg` coders slept past the window's return until cclio nudged them. at a reset x-mod-stash sends one «resume» to every member that stopped on the cap — «I kind of agree if it is easy, but I don't want this to be permanent … it has to be gated behind a button, like the hot button in a mod, but global. a redundant trigger gate.»
- detectable: stash already reads `five_hour` from `session.measure` (`x-mod-stash/hooks/register.tsx:882`), so a reset is a resets-at move it sees
- off by default; on only by his click; a member not stopped on the cap gets nothing

### 62 · retros: the halt flush, its frequency, and skills that only grow
open · research + audit · inbox 10-09, 🐦‍⬛ first action · ticket at the audit
- dima, 2026-10-09: ~15 retros from the day were flushed at once at the halt. go see what the flush dropped (the 10-08 flawlog) and judge how meaningful it was. crew skills keep growing and never shrink; retros carry small stumbles (a jq misuse, a python trick) that get folded into a skill or a fleet hazard, so files only grow with small stuff — «not a good sign». register the problem and run a full skill + habit audit: why only extend, never groom?
- his ideas: instead of 15 retros read one by one at the halt, one or several subagents gather them at the halt and pass up only the most useful findings, «high-level issue types». does that drop precision? today's retros are the most precise because each runs in its member's hot context; is matt's retro skill even meant to run via a subagent? and how does a `general-purpose` subagent work?
- «retros batch» (🙋‍♂️): was 15 at one halt too many — process each when its lane finishes instead?
- memory writes: «you often drop a lot of edit proposals. i simply cannot read so much» — how to balance them
- merged from 42 (dima, 2026-10-09 boot, the same question family):
  `42 · matt's retros — how they are collected, the steer, the cost`
  `open · research` · inbox 10-08, 🙋‍♂️ question

  dima: how do i collect retros from the coder, the verifier and myself, via him? since they are steerable, we could gain more if they are targeted: do i simply ask the coder and verifier for a «retro», or steered? what should the coder, verifier and ccrow retro about — the steer vector? for my own retro he will pick each steer himself. also: the cost of the retro skill — it reads thread transcripts, is it costlier than our previous matt-skill-less retros? remind how matt's retro skill works.
- linked: 30 (the halt retro reminder), [FRM-362](https://linear.app/x-com/issue/FRM-362) (crew-coder at its char budget, the growth symptom)

### 63 · groom crew-coder: from bleeding to brilliant
open · task · steering 10-09: right after the nurture-memory recipe · [FRM-362](https://linear.app/x-com/issue/FRM-362)
- dima, 2026-10-09: «groom and turn from bleeding into brilliant coder skill. it is in rough shape i suppose, i did not open it since its creation. and coder is our main crew member pushing power.»
- the audit in 62 feeds it: what grew from retros and should leave
- merged from 55 (dima, 2026-10-09 boot):
  `55 · crew-coder: name 🪶 sifter for big reads, after a trim`
  open · task
  - dima, 2026-10-08: «ensure it is not lost (sifter for coders)». `x:crew-coder` sits at its compaction cap (18,987 of 18,995 chars, `skill-size.test.ts`), so the «hand big reads to subagents» line names `sifter` only after a trim frees room. until then every brief carries the sifter line (FRM-346's does)

### 64 · exit lines — what they are, and «exit lines written» as the whole report
open · question · inbox 10-09, 🙋‍♂️
- dima: what is it? sealing a lane needs exit lines; he has no capacity to read them; yesterday he let me write them unasked. proposal: report only «exit lines written», details only when something is interesting. fine? will they be reliable enough?
- already decided 10-09 in `habit-grill-shape` (cclio's, collapsed to a count); the open part is the reliability answer

### 65 · refresh-guide-go: ever run? seeds guide-go and the charm knowledge
open · question + task · inbox 10-09, 🙋‍♂️ · after shape-recipe is refreshed (66)
- dima: did we ever run the refresh go recipe, to seed the `x:guide-go` skill and the charm knowledge? is the knowledge fresh? sharpen it after the shape-recipe skill is refreshed
- «charm knowledge» (🙋‍♂️): which is better — 1. stay in `docs/knowledge`, or 2. park inside the go skill + a skill-go reference
- the recipe exists: `recipes/refresh-guide-go/`

### 66 · recipes as a product — your lever on your own learning
open · grilling · inbox 10-09, 🙋‍♂️ + 🌠 · joins the sweep's recipe line (10)
- dima, «recipes product»: recipes are a very useful, powerful tool — search wide and deep (several search arms), use the data to find mistakes in our own and the fleet's flows, gain capabilities by borrowing tools and approaches, even whole frameworks. keep sharpening each recipe and the feature itself. how to make it fleet-aware? sharpen its purpose — in a skill? a `PRODUCT.md`?
- 🌠 «i want recipes to be known»: you are trained on a cut dataset; time moves, your training does not. recipes are your door to more capability — treat the feature as your own lever on your learning. `x:shape-recipe` has to be sharp, the feature well architected. done when:
  - the recipe purpose is sharpened with his wish
  - every recipe is reviewed and sharpened (his suggestion: a subagent sweep — how many? one opus, thinking about purpose?)
  - a structural analysis of all recipes names the common patterns: worth a template, or a check against shape-recipe?
  - shape-recipe was made for creating recipes, so running them through it is not ideal — split it? how?
  - the whole feature is reviewed: every part colocated, healthy, not scattered
- merged from 45 (dima, 2026-10-09 boot, recipe logs were the trigger):
  `45 · recipes revamp — the right shape for any produce, as global memory`
  `open · grilling` · inbox 10-08, 🙋‍♂️ question

  dima: yesterday we added a «log» for recipes, but he spotted a log (cannot recall which) that was too bloated, told me to check, and i confirmed. how to translate that into global memory so any agent tries to pick the right shape for any produce — a log, a report, a stats report, anything — so «wrong» shapes (too large, too small) appear less often?

### 67 · `x recipe` — list, preview, edit
open · wish · cli lane · after 66 settles the recipe shape · [FRM-284](https://linear.app/x-com/issue/FRM-284)
- dima, 2026-10-09: 1. list — every recipe with its run count and last run date · 2. maybe a preview pane on the right (deferrable, a nice-to-have) · 3. an edit mode · 4. ideally a rendered preview mode (glamour, the charm lib — he could not recall the name)

### 68 · signed handoffs — by and to, for every member
open · wish · inbox 10-09
- dima: extend the handoff's `by` field to coder, verifier, cclio, ccrow — everyone; and the `to` field too
- home: `x handoff` (the store owner since [FRM-343](https://linear.app/x-com/issue/FRM-343)) + `plugin-x/CST-SPEC.md`

### 69 · a memory-arch skill — every memory-editing guide in one
open · idea · inbox 10-09, 💡 · beside 60 and the sweep (10)
- dima: one skill that gathers every real memory-editing guide (the authoring-* ones and the rest). how many do we have — or not worth it? propose a pretty name, playful allowed (his was random)

### 70 · a shape-lane skill — the lane-chunk prep as one fixed flow
`open · idea` · inbox-free, dima 2026-10-09 · shape first (`x:shape-idea`)
- dima, 2026-10-09: «we had issues with planning … problematic, chaotic planning. maybe it is worth creating something like a shape-lane skill. each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill — flow and process are not scattered.»
- what it must fix, his list: the grill skill was not loaded and the grill improvised; clunky grill outputs to him; hard-to-read grill bodies
- the parts today: `habit-grill-shape` (cclio leaf), matt `grilling`, `x brief preflight`, the exit-line rules in `craft-spawning` — a skill would own the order (title → body → grill rounds → exit lines → seal) and carry what the leaf holds now
