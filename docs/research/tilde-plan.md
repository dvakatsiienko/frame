---
dies-when: FRM-368 is built or canceled
---

Ticket: FRM-368

# FRM-368 — clio first, tilde second: the plan

status: draft v5 for review, 2026-11-04. nothing here is built, filed or signed yet.
sources: `docs/research/tilde-want-and-surfaces.md` (dima's words, N1–N56, and the surfaces; «cap» there is tilde's old name), `_clio/blueprints/excalidraw/tilde-sketch.jpg` (his sketch), `docs/research/tilde-own-evidence.md`, `tilde-prior-art.md`, `tilde-shift-baseline.md`.
v1 was read by crow's critic (5 findings, 4 high), wishkeeper (26, 4 high) and wisphunter against the live code (10 bugs). v2 folds them; each fold is in its row.

## want

dima's words, folded; N-numbers point into the want file.

- N1–N6: main clio is almost always busy; active side lanes make noise, blur the main lane, clutter her context and make her compact too often. rebalance: the main lane stays with clio, lane activity moves to another thread.
- N7–N12: a new crew member, a coordinator. clio shapes the chunk and the spec and dispatches; the coordinator checks the spec is valid, starts codie, guides it, solves blockers, spawns sixth sense, guides the lane to ready-to-merge, then pings clio for a decision. the flow stays as today; only coordination and lane comms move.
- N13: every roadblock, ask to dima or dispute is lifted through the coordinator to clio.
- N16, N19: both modes bulletproof: clio coordinates herself, or she starts tilde and delegates. tilde is experimental, habits drift everywhere, it must not ruin the current clio model and must be easy to revert.
- N18, N32: side, shift, quick and mods lanes all get tilde; designer lanes stay tied to clio for now.
- N24: how does tilde's second wind work; is the lane parked meanwhile.
- N25, N31: multiple side lanes at once are rare, but possible, and supported.
- N29: keep-hot always on for coordinators, at least to catch one parked with no actions.
- N46 (ticked): one dedicated `--bg` tilde for all side lanes, stopped when no lane runs.
- N47 (ticked): split the plan: first apply the best practices to the current clio, where applicable, then implement tilde on what is already done.
- N48: the role is Opus 5.5 medium. a weak coordinator is a no.
- N49 (ticked, with his steer): wishkeeper runs before ready to merge, for both clio and tilde, «via symlink if it works; lifting to global is not a good idea, it's unique to coordinators».
- N50: there is a window to test FRM-501; tilde need not be tested at once.
- N51, N52: a hierarchy costs turns, spamming clio costs tokens and attention; tilde talks to clio only when needed.
- N53: tilde relays without rewording; a tilde request means clarification, maybe a re-sign ask, never a blind action; clio verifies, may check with the crew directly, may take the lane over.
- N54: a held-ping path for tilde too; a context meter as an automated mod, like pace watch.
- N55: tilde may read anything; how else would a coordinator catch mistakes. his later steer, on one read under `_clio/`: «tilde better to not visit clio's folder».
- pk-307: W1855–W1862: side-lane codie and sixth sense context is watched, «so SW happens for everyone», «outside shift, too», «ideally SW is handled mechanically; I suppose a manual step is a place for a miss». W1904–W1908: «I like to tweak this value in settings», applying to all threads, «including yourself», no finer grain. W1892–W1899: can clio see and flip keep-hot on any thread; if not, add it as a rider.
- his 2026-11-04 line on clio's own wind: he watches her when not afk; while afk she winds herself. this narrows W1907 for clio's trigger, not for the threshold.
- N39, N42: second wind: at 55 % a notice (65 % is the upper boundary, plan your nearest steps, park, solve tails, no rush); at 65 % a second wind is a must; every member does it itself, printed in global rules.
- N36, N40, N44: a 2-week test drive by clio; its own linear app and avatar.
- his o32 steer: «who builds? can you build?»

## constraints

- root invariant 3: nothing built before shaped; new surface carries `## ⚖️ worth it` and `🔌 fleet wired:`.
- nothing of clio's is deleted before the test drive's verdict; opt-in per dispatch.
- his one-side-lane-per-5h rule stands (`clio:shift`).
- `rules/` lines change on his word.
- this side channel never pushes, never summons, never messages a lane member, crow or helga. a summon is main clio's.
- a mechanism over a firmer intention: the 11-03 retro says «a second line will not hold». a words-only row names why it needs no mechanism.

## the evidence that shapes the cut

- 129 coordination failures in 14 days: 48 in lane traffic, 60 on the main thread, 21 elsewhere; lane retros only exist from 11-02, and on 11-02/03 the lane share is 41 of 72. so tilde reaches 37–57 % of them.
- lane wakes: 65 of 91 turns on 11-03 (14:33–19:17) were member-woken; lane wakes took 66.5 % of her reads over the 118-turn shift count. FRM-501 went after those wakes and has no number yet.
- sixth sense's clean left a real high in FRM-472 and FRM-492 (`pre-merge-siesta.md`, shift log :132); FRM-491's order of clean and read is unclear «?».
- 7 of 14 spec defects looked readable from code at seal. crow's critique of FRM-494 still let two false premises through, so this read is a code read, not a plan read.
- hangs: 6 in the window, 3 `#dima-caught`, 1 in a lane; the source calls absence here weak proof.
- no lost work is proven across a compaction on 11-03.

## the seven best practices, where each lands

his o32 tick said «clio gets the 7 first», and N47 says «where applicable».

1. no relay → already true for clio (`x:crew-dna`: rounds run codie ↔ sixth sense). tilde's contract keeps it.
2. refusals by tool → tilde only; clio holds those rights.
3. lane file and round counter → the counter in P1c. the rest of the file in phase 2: nothing proves clio needs it, tilde does.
4. ping never consent, ready carries proof → P1a.
5. spec read against code at seal, greenlight check → P1a.
6. watcher → moved to phase 2, open question 4.
7. the role → settled, Opus 5.5 medium.

## phase 1 — clio's lane loop gets better, no tilde

each row ships alone and is useful even if tilde is dropped.

### P1a. the seal and greenlight check, skill lines — built by the side channel
- `clio:shape-lane-dispatch`: before the seal, one card reads the spec against the code: every path, premise and «already exists» claim; findings fold into the spec. a card, no new surface.
- `x:crew-lead` § greenlight: each exit line maps to a step of codie's lane plan; a line with no step refuses the greenlight.
- `x:crew-codie`: codie's report on sixth sense's clean carries head sha, the test command with its exit, sixth sense's verdict verbatim. words only, on purpose: wisphunter found a gate catches a legit quick-lane `final` and helga's `[done] receipt`, breaks 8 quiet fixtures and can starve `siesta-gate`; and wishkeeper reads the diff itself, so a thin ping has a second reader. promoted to a gate only if a count shows misses at 3 lanes.
- wishkeeper before ready: main's `clio:siesta` never skips it (dima, 2026-11-04), but only `clio:shift` orders it before a merge, and `craft-fleet-flow` § land and `docs/knowledge/pr-flow.md` do not name it. so one line goes into § land, off shift too: a chunk merges after wishkeeper read its base..head, and `clio:siesta`'s brief names that range for an unmerged pr. the card's «never for codie's work» changes in the same edit: it reads a chunk against his words, sixth sense grades the exit lines.
- words only, on purpose: `siesta-gate.ts` already blocks a turn once a `[done]` makes a siesta due, so the mechanism exists; the line only names the range.
- his tick binds past the trial `pre-merge-siesta`: if its kill rule fires on 11-17 or sooner, the tick comes back to him, it does not lapse.
- a ping is never consent: `craft-fleet-flow` § land, `x lane merge-auto` and `--dima-ok` already hold it; audited once at P1 done by listing every merge door against his word.

### P1b. cut
the `[done]` gate of v1. see P1a.

### P1c. a round counter that survives a compact, mods — mods codie, through main
- a new branch in stash's `SendMessage` tool hook (none exists for this today) counts `round N` under one store key per lane, not in the lanes file, which `writeLanes` rewrites whole with no lock; no new verb, no bump by hand.
- past the cap the sender's line says the stop goes to the coordinator. the counter only signals: the cap's P0/P1 and scope-reset terms stay sixth sense's judgment.
- restored through `compact-carry.sh`, the one path that runs off shift (`shift-recompact.sh` exits with no shift, `crew-recompact.sh` holds no lane id).
- `## ⚖️ worth it`: removes the cap bent twice (FRM-472, shift log :90); cheaper door turned down: a line in the lane plan, nothing reads it; upkeep: one hook branch. `🔌 fleet wired: codie's round message, clio's compact carry`.

### P1d. cut
the hook edit of v1. the 71k block this session took came from cc's own load below the project dir, which a session booted beside `_clio/` never meets; a probe from outside frame got a 370-character note from `memory-load-agents-md.py`, and the hook caps at 8k. dima's steer settles the rest: tilde stays out of `_clio/`, refused by tool. FRM-491's codie retro about that hook stays a small wisp for main.

### P1e. second wind that runs itself, its own ticket — mods codie, through main
- folds pk-307 (the mechanical second wind) and pk-315 (the wisp): crow's `--bg` second wind on 11-03 compacted and never ingested, and sat idle until a nudge. a `--bg` member cannot wind itself until that is fixed, so pk-315 goes first inside this chunk, proven on a throwaway `--bg` session: it winds, ingests and answers with no nudge.
- `session.measure` holds each session's fill, and a `--bg` session's prompt hooks load (`mods/engine.md:29`; read in code, proven at build).
- measure fires after a main-thread turn (`mods/api-map.md:64`), so inside a long turn its number is stale. the check reads `$.session.usage` on the step path as well, because a long turn can cross 65 % with no prompt; which door gives a live fill is proven first, with a long codie turn as the fixture.
- 55 %: one line, once per crossing, re-armed after a wind: 65 % is the upper boundary, plan your nearest steps, park, solve tails, no rush.
- 65 %: the mod writes the session's own 🐦‍🔥 ask, the state dima's press makes today, so the trigger is mechanical and the flow is the one that exists: its next turn carries a note, it writes the handoff, `op second-wind` compacts and ingests. the writing stays the session's, because only it knows its tails. past 70 % a member's overrun pushes one line to its coordinator, which is the fallback.
  - it writes the key only when none exists, once per crossing, never through `pressWind`, which toggles: a second press deletes an ask and cancels a wind. dima's ↩️ holds until the fill drops and re-arms.
  - its own note: today's `WIND_NOTE` says «dima asked» and «never urgent», and he said a must at 65 %. the auto note says the mod asked, the wind is a must, and the current step still finishes.
- both numbers are knobs in 🎛️ settings, one value for all threads (W1905–W1908).
- clio: his word: «Clio only proposes Second Wind. She runs Second Wind herself only when I am AFK.» so at 65 % at the keyboard she proposes it to him; the mod writes her ask only while afk.
- keep-hot door (W1892–W1899), a firm rider: FRM-499 is his click chip, and crow's `armHot` is the only agent door. a `hot` key on `pnpm mods:set` reads and flips any session's keep-hot; clio uses it, tilde later for its crew.
- W1845, «everyone should be auto-woken» when stale over an hour, has no chunk yet. FRM-499 does not build it. main clio holds the live talk (his W139–W141, today: keep-hot on by default for any side lane, or for everyone); this chunk builds what that answer says, a default in the same store.
- W1903 asked to be reminded when this chunk is done: its look card says so.
- before the build: `duckdb` over 14 days of lane transcripts: how often a turn jumps a line, and the fill at the next prompt.
- `clio:shift` lines 45–47 («second winds are mine to plan», «never past 60 %», a member names its % in each ping) and `rules/fleet-mods.md` («every member's wind runs by itself») change in the same landing as this chunk, never before it.
- a member's wind on a lane: finishes its round, parks, winds. the other member waits on its message as it does today.
- `## ⚖️ worth it`: removes dima telling members to second wind by hand, daily (W1857), and winds run on guesses (shift log :89); cheaper door turned down: clio or tilde watching the board, which is the manual step he named; upkeep: one poll branch and two knobs. `🔌 fleet wired: every session's own stash, first real call on the next lane`.

## phase 2 — tilde, on what phase 1 shipped

### the gate, before any of it (crow's high, his call)
after phase 1 and FRM-501 run, re-run the baseline query over 5 codie chunks, not a day count, because 3–5 days can hold too few lanes. first run the same query over 2–3 past windows with nothing shipped, to see how much it swings on its own. compactions are counted with the second winds split out, since P1e's winds move that count by themselves.
the numbers go to dima beside the right-if lines (≤5 wakes a chunk, half the compactions), and his own attention weighs as much as they do. his word, 2026-11-04: «no rush with it. let's make clio better first. i still think tilde is useful because side lane spam attention spans me. let's see how it goes after all updates + silent mod fixes.» nothing builds automatically, and a met number alone does not retire tilde. `## ⚖️ worth it` for FRM-368 is written then.

### the shape
- one `--bg` session named `🪼 tilde`, Opus 5.5 medium, boots in a tracked `_tilde/` beside `_crow` (`AGENTS.md`, `.claude/settings.json`, deny hook, `bgIsolation: none`), started by clio at a lane's dispatch and stopped by clio in the merge turn that leaves no lane running (`x lane landed` prints it). user settings stay loaded: crow's `project,local` would drop the x skills. the home carries its own env, `additionalDirectories` and the trial spawn gate, copied from `_clio/.claude/settings.json`.
- contract: new skill `x:crew-tilde`, step 0 `x:crew-lead`, with the skip list inside (93 of 222 crew-lead lines are its own, `tilde-own-evidence.md` § 3). clio never reads it. crew-lead is not trimmed during the trial.
- members: one line in each member skill, «clio below means the coordinator your brief names»; `x:crew-dna` lines 24 and 30 change; `x brief check` refuses a brief with no `coordinator:`; chunk 1's test proves a member answers only the name in its brief.
- opt-in: `coordinator: tilde` in dima's pick or the shift plan. no switch. revert = stop writing that word, and the rows that touch a clio lane anyway (member lines, `x brief check`, watch routing, four rules) are run through one real clio side lane with a pr after chunk 8, because a quick lane never fires `pr-watch.sh`. revert does not undo those shared rows: they stay, mode-neutral, and that lane is what proves N16.
- adoption: clio's takeover sets the lane row's owner to clio and sends each crew member one line naming her as coordinator; `crew-recompact.sh` prints the current owner from the lane row, so a compacted member does not ping a stopped tilde. built in chunk 6, rehearsed with a member compacted after the takeover.
- no relay: codie ↔ sixth sense stay direct; tilde passes paths and verbatim words.
- reads the 5h pace at every summon (the crew preflight does not, FRM-368 notes).

### rights
- allowed: check the spec, summon and stop its crew, steer, greenlight, next-chunk messages, park and resume, subagents, step its glide card, `x linear comment` as `x-tilde-cc`, read anything outside `_clio/`, wishkeeper.
- refused by tool, one row per refusal naming tool and matcher, each proven by a planted attempt at build, subagents included:
  - Read, Edit, Write on a `_clio/` path; Edit and Write on code, skills, memory and spec paths (a spec's exit lines live there); a path matcher.
  - Bash: `cd` or a path argument under `_clio/`, `x linear` verbs other than read and comment, merge verbs, `x lane dispatch`; a text matcher in x-mod-guard's shape, so a script that hides a path can pass. the residual is named, not claimed closed.
- words only, no tool can see them, with the reason: the want, folding wishes (their stores are refused above, the meaning is not), starting an unhanded chunk beyond `x lane dispatch`, carrying a word from one lane to another (counted as blur at the test drive).
- what tilde needs from `_clio/` moves out in chunk 1: the lane stages of `craft-fleet-flow` go into `x:crew-tilde`; `_clio/script/idle-check.ts` (`crew-lead/watching.md`), `_clio/.claude/hooks/pr-watch.sh` and `ci-watch.sh` (`crew-lead/briefing.md`, `crew-sixth-sense/SKILL.md:147`) move to the shared hooks, every caller repointed in the same commit.
- clio keeps every linear write, the merge, `x lane landed`, the look card, the fleet-wide 5h ladder.

### what clio hears
- `[done]` ready to merge: sha, tests, sixth sense's verdict, wishkeeper's verdict. `[ask]` a dispute it cannot settle, a re-seal or joiner ask. `[escalate]` blocked past the spec, a round-3 stop. all else slipstreams.
- a question for dima sits on the glide card and slipstreams to clio; 900 s unanswered it becomes `[ask]`, the rule `x:crew-dna` already has (open question 1).
- clio verifies before acting on any of them, may ask the crew directly, may take the lane.

### chunks
1. `_tilde/` home, `x:crew-tilde`, member lines, identity row (🧢 cap → 🪼 tilde). wishkeeper: symlink at `_tilde/.claude/agents/wishkeeper.md`, proven listed today; the card gains a lane mode, because its siesta mode needs `siesta-checks.ts` and `clio:siesta` does not resolve from `_tilde`, and its description «dispatched by clio, never for codie's work» changes. lane mode reads his words from the ticket, the spec and the diff, and nothing under `_clio/`: its opening reads of `craft-pm` and friends stay in the clio modes. tilde's name joins `siesta-gate`'s `from-name` only if clio still runs its siesta on tilde's `[done]`, open question 5.
2. the mods split. the code assumes one coordinator, so `isCoordinator` is not widened. three predicates:
   - clio only (`isCoordinator` as it is): pace, waker, crow relay, boot, `x-mod-guard`'s linear gate. the guard row of v1 is dropped: widening it would pass the raw writes tilde is refused.
   - lane writer (clio or tilde): the glide. each lane row gets an owner; `takeLaneMoves` and the stale check filter by it, or busy clio eats dima's tick on a tilde lane; `writeLanes` gets a lock; `LANE_OWNER` goes. `LANE_ROLES` gains `coordinator`, so tilde's asks reach the card and his tick reaches tilde.
   - quiet home (clio or tilde): the hold. clio as sender is exempt in tilde's gate, or her untagged dispatch to an idle tilde is held and the lane never starts. `clioAddress`, `quiet-log`, the gap and asked books key per session, or FRM-501's number blurs.
3. `x/go`: `linear.go` actor and `keys.go` `linear-tilde-id` ship together with the app of chunk 9, keeping the `codie` fallback until then, or every actor caller fails, reads included. `brief_summon.go` wording.
4. wakes: `pr-watch.sh` and `ci-watch.sh` share one `SEEN`, so two Monitors steal events; each home gets its own `SEEN` and a pr filter read from the lane rows.
5. keep-hot, N29: `hot:<sid>` written at tilde's start, as crow's start does; tilde's ping text forks from the shared one (`register.tsx:284`): it runs one crew check and speaks only on a stuck member, instead of today's one-character reply.
6. the lane file and adoption: tabletop first: list everything in flight at tilde's death and name its home: round count and crew (lane row), tilde's open asks (its orbit), held pings (`quiet-held:<session>`), greenlight state, owner. what has no home goes into one file in the lane's state dir, restored by a compact hook. plus the takeover above.
7. the watcher: a token-free script outside every session, 3–5 min tick, `claude agents --json` (status, sessionId; `--all` adds 250+ dead rows), plus the file's age; `state` reads `working` on idle rows, so it reads `status`. a silent tilde or member reaches clio as one line, by socket or the relay in `x:crew-adviser/scripts/wake.ts`, proven against her desktop kind.
8. clio's half, the fork per mode: `shape-lane-dispatch` §5–6, `shift`, `siesta` 2.5, `halt`, `pm` `references/closing.md`, `craft-fleet-flow` stages 5–8; rules `fleet-flow.md`, `fleet-identity.md`, `fleet-mods.md`, `fleet-vibe.md`; sweep: `crew-recompact.sh`, `shift-recompact.sh`, `registry.json`, `docs/knowledge/pr-flow.md`, `fleet-ops.md`, `fleet-operator-comms.md`, the three refresh recipes.
9. linear app `x-tilde-cc`, avatar through `x:art-kit`.
10. a per-lane token meter, before the clock starts: a `duckdb` read over a lane's member transcripts, run once over 3 past lanes for the baseline the kill line needs.
11. test drive card through `clio:shape-test-drive`. retro card on the first 3 lanes; clio checks tilde at siestas and keep-hot wakes; no new auditor card.

### tilde's own second wind (N24)
- the P1e notice reaches it like any member. at the must: each lane's crew keeps its direct rounds, tilde parks its own open steps in its handoff, winds, re-reads the lane rows. pushes wait in its held list. no lane is forced to park.

### shift
- fleet-wide stays clio's: shift plan, waker, merges, report, pace.
- per lane goes to tilde: the meter after each step, park and resume, 🔥 for its crew, the log in the lane's state dir.

### mods lanes
- clio starts codie's desktop tab (a `--bg` tilde likely has no ccd tools, untested), tilde takes it over by message. dima watches mods live as today.

### measures
- the baseline is re-run with phase 1 live, so phase 1's and FRM-501's gains are not credited to tilde.
- measured: clio's reads, her lane wakes per chunk, compactions a day, tilde's tokens, 5h burn, `#dima-caught`, his interruptions.

## the order

1. tickets: one phase 1 ticket (P1a, P1c), P1e's own ticket, FRM-368 rewritten as phase 2. his sign on the first two now.
2. P1a here; P1c and P1e into main's mods queue, placed by clio against what is there, from a draft order dima reads first.
3. FRM-501's first number, read with phase 1 live; P1a's words do not touch its gate.
4. the gate above, his call, with the numbers.
5. on a go: the tilde board with his sketch merged, for his edit, then his sign through `clio:shape-lane`; chunks 1–10; a two-lane rehearsal and a kill rehearsal; then the 14-day clock.

## who builds

- skills and memory (P1a): this side channel, on his sign, in this worktree; they land when main merges the branch at the halt, a plugin bump after. the merge-door audit is mine too, printed to him.
- `rules/fleet-mods.md` and `clio:shift` lines: main clio, in P1e's landing, on his word in the sign. `compact-carry.sh`: goes with P1c, mods codie.
- mods: mods codie, through main.
- `x` go code, watches, the watcher: a codie side lane with sixth sense, dispatched by main.
- this channel summons nothing and pushes nothing.
- his word on o39: «prep everything for Clio, so Clio only can rearrange and fix because she has a slightly newer history of current mods lane and everything else. Do all the heavy lifting yourself, and do Clio-only verification, cleanups, slight tweaks, and maybe mods lane execution order tweaks.» so this channel writes the tickets, the spec drafts with exit lines and the skill lines; main clio verifies, reorders, seals and summons.

## done test

phase 1, as dima sees it:
- given a spec with a false premise a code read can find, when it is sealed, then the premise is fixed before codie starts.
- given codie reports on a clean, then the report carries sha, tests and verdict, and wishkeeper has read the chunk before the merge.
- given a lane past 3 rounds, when a compact happened in between, then the stop still fires from the counter.
- given any member, a `--bg` one too, reaches 55 %, then it hears the notice with no one telling it; at 65 % it winds itself and picks up with nothing lost.
- given every merge door, then none merges on a ping alone, read from the audit.
- given a `--bg` member winds, then it ingests and goes on with no nudge.
- given he edits a threshold in 🎛️ settings, then every thread uses it from its next poll.
- given clio asks for a thread's keep-hot state, then she reads and flips it herself, no click of his.

phase 2, as a test drive card:
- believe: clio's thread stays on the main lane.
- test: every codie lane for 14 days.
- right if: ≤5 wakes a chunk, half the compactions, burn up ≤15 %, against the re-run baseline.
- kill on: one lost ask, two false ready, burn up 30 %.
- given tilde is killed mid-lane with one open ask and one held message, then clio reads the state and adopts the lane, and pings and pr wakes move to her, with nothing lost.
- given two lanes on one tilde, then no word of one reaches the other's crew; one cross-lane word counts as blur, and two split the role.

## out

- no trim of `x:crew-lead` during the trial.
- no new auditor card; no Sonnet grade.
- designer lanes.
- no github app for tilde.
- `crew-pm-flow` board redrawn only at the verdict.
- one tilde per lane, unless lanes blur.
- the a/b of the old ticket: the 14-day card replaces it. «capacity allows» is his call at the gate; the weekly window is his to watch.

## open for dima

asked now, for phase 1's sign: 3, 4, 6, 8. kept for the gate, since they only bind phase 2: 1, 2, 5, 7.

1. a question for dima from tilde: glide card and a slipstream, `[ask]` only after 900 s. pick: yes.
2. disputes: tilde settles what the spec and the code settle; a question of want goes `[ask]` with both sides verbatim. joiners and re-seals: never tilde's; `[ask]` to clio. risk: five re-seals in one shift log could make this a busy door, the wake count will show it. pick: yes.
3. phase 2 gated on the number: tilde stays unbuilt if phase 1 and FRM-501 already meet its right-if. pick: yes.
4. the watcher and the lane file sit in phase 2, and the `[done]` gate is cut to words, against the plain reading of his «the 7 first». nothing proves clio needs them today. if the gate stops phase 2, these two are dropped with it, and a hang still reaches him as today; pk-315's fix removes the one new hang shape phase 1 would add. pick: yes.
5. wishkeeper on a tilde lane: tilde runs it before `[done]`, and clio's siesta then skips its wishkeeper for that chunk. pick: yes.
6. who dispatches phase 1: main clio, from a handoff this channel writes. pick: yes.
7. «tilde better to not visit clio's folder»: refused by tool, its subagents' reads included. the softer reading is a rule line with no refusal. pick: by tool, because a rule line is what the retro says will not hold.
8. clio's 65 % press fires only while afk, the 55 % line always. pick: yes.
