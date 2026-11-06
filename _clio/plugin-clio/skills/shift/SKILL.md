---
description: load when dima types /clio:shift <plan>, says «start shift», «i go, run it», «i'm afk», or leaves a written plan to run without him.
argument-hint: "<plan file>"
---

# /clio:shift <plan file>

A **shift** is a lane built to run without dima (FRM-266). A lane asks and waits. A shift
**decides, logs and continues**. The plan file is the authority; the last shift file in
`_clio/shifts/` that ran (`status: done`) is the template. A shift over ✍️ signed chunks names them in its plan and runs each through
`clio:shape-lane-dispatch` in their order (lane init's contract: `craft-fleet-flow` § lane init) — nothing in it waits on dima.

## presence — his afk switch drives it

one shift, day or night; how it drives follows the band's afk switch (💨, x-mod-stash), which puts an away note on every prompt while on:
- **afk on** — nothing waits on him; an ask goes up only by § 2's bar.
- **afk off** — he is near for now: a y/n ping only for a real decision, batched at a siesta.
- a shift started with afk off gets one line: «afk is off — near for now, or a slip?»
- an approve sent from his phone covers only the act it names, never whatever else is ready

## the 5h ladder — no lane runs far ahead of pace

⏸️ paused while he is on the $200 plan, which has no 5h window (`habit-ctx-load-balancing`): this section and the `mods:set pace` calls below do not run, and i read `stash.waker` on instead.

pace = the elapsed share of the 5h window; over = used − pace. read after every step, in every mode, until he says «go» for a burn day; when two rungs hold, the higher wins: 97 % › ≤ 55 min › 90 % › +5 › resume; the first 10 % of a fresh window parks nobody:
- **+5 over pace** (the band's -5 %) → everyone parks at a pit stop, 🔥 on for all, resumes at −2 (the band's +2 %); +10 is never meant to be reached
- **90 % used** → everyone parks, 🔥 on for all
- **97 % used** → everyone pauses now, never an abort, each continues from its spot at the new window; the rest is for small asks
- **a new window**, the mod's line after a stop or a park → i resume everyone; a park he called by hand stays
- **≤ 55 min left** → in a shift, every lane starts its next useful chunk and burns to 97 % (no waste burning); with him at the keyboard, ask first
- **one side lane per 5h window, for now**, unless he asks for more out loud (dima, 2026-11-03: «with two side lanes, everyone will just park and pit-stop and start too frequently»)
- **a park**: the running step finishes, nothing new starts — subagents, reviews and reads included; at 90 % running ones stop and re-run after the resume
- **a resume** runs in lane order (clio, the lane building, then the reviewers), the meter read between each; my own second wind runs before a park, never on the resume
- while everyone is parked, the pace watch tells me when a rung changes, and i act on its line

## comms while he is away

- the main thread is clio's own log: only what a post-compaction clio or a returning dima needs.
- when he returns: **one** digest — done, decisions taken, parked asks — then the lane resumes.

## surviving a compaction

state lives on disk, never only in context: after **every** step, the plan file's `## log` gets
the current step, the decisions and the open asks. the `SessionStart:compact` hook (`.claude/hooks/shift-recompact.sh`)
re-reads a plan whose header says `status: running` after a compaction, and `pnpm shift:checkup` proves the hook.

- **second winds are mine to plan, for everyone** (dima, 2026-11-03: «since you observe and you can plan, pick good times for everyone … and you should second wind everyone»; 2026-10-21: «during the shift, when I am AFK, it is fully up to you, so be careful with this»):
  - the line: about 55 % context, never past 60 %, at a step's end, never mid-chunk — mine through `clio:checkpoint`, a shift or his «afk» without one (o73); `get_usage` reads my context and the 5h window after every step
  - context grows slowly on a shift, so each wind is planned a step ahead, never rushed: after every step i read my own % through `get_usage` and each member's on the band, and a member near the line gets «second wind after this step» from me
  - everyone means everyone live: codie, sixth sense, crow, helga, and a parked wing

## hot caches — no member goes cold

dima, 2026-11-03: «to keep everyone's cache hot and never let it go cold, any thread inactive for 50 minutes is auto-woken by keep-hot».

- keep-hot (🔥, `x-mod-stash`) pings a session 50 min after its last turn; every member's 🔥 is on from the shift's start, mine included: his click on its 🌌 sessions row, or crow's `armHot` door; no hand beat

## 1 · start — the last chat message

- `pnpm shift:checkup` in `~/frame` — every compaction guard red+green, spare age, `📡 watch-pr`, each with its why; any 🔴 = no shift
- a bytes app in the plan passes `apps:essentials`
- write `status: running`, `afk:` (on/off at the start), the members and each lane's merge rule into the plan file; no weekly budget line: the week is his, the ladder paces
- every pr chunk in the plan gets its merge word while he is still here: one orbit ask, `✍️ sign FRM-1, FRM-2: merge pre-approved for this shift`, and his tick lets me write `merge: pre-approved` under each one's last sign, so a self-edit lands with him fully afk. every chunk, not the ones that look it: a fix can grow into a self path mid-shift. a re-sign voids the line, so a re-signed chunk parks ready until his word
- every live member's 🔥 on (§ hot caches); a wing parks with the shift, its merges and wishes queue on its branch until the end; `pnpm -C ~/frame mods:set pace on`, which also turns the ⏰ waker on and notes what it found
- one message to dima: mode, members, when the report lands. **from here the shift is on.**

## 2 · run — no asks

Every decision is one of three:

- **reversible** → take the default, log `decided: X — undo: Y`, continue
- **irreversible or external** (a delete, prod, a message, a setting, a move or drop of a line of dima's) → park it with its
  reason, never block other work on it
- **a merge lands itself** (dima, 2026-11-03: «the usual pattern for shift is that you merge automatically without my approval»): a clean pr by the gate, a self-edit when its chunk's `## signed` carries `merge: pre-approved`, a quick lane's chunk by its close; each one only after its pre-merge 🌤️ siesta, wishkeeper over the chunk (`docs/test-drive/pre-merge-siesta.md`). a day's exception — «hold this lane at ready for my ok» — is written into the plan file's rules for that lane only, never into this skill
- **taste** → build one default, flag it for the report

- before i tell him a merge lands itself, `x lane merge-auto <pr>` is read
- a signed clause found unmet goes to orbit at once, never accepted alone
- the ⏰ waker stays on while he is afk: i read its key at every step, and off means i switch it on through `pnpm -C ~/frame mods:set pace on`
- a mods chunk starts as a desktop thread like any mods codie (`x:crew-lead` § the doors), never `--bg`
- codie's premise doubt is built and flagged the same minute, never found at review
- every «done / fixed / sealed / reset» i log or tell names the command that read it back, with its exit code; a member's relay says `measured:` or `inference:`, and no ticket is born from an `inference:` line mid-shift
- a joiner chunk gets its spec section, `x brief preflight` and `x lane dispatch --apply` before its steer; its reviewers match its `## signed` line
- events go to the plan file's `## log`, append-only, oldest first (time · who · what · evidence), never to chat. while afk is off,
  dima's messages still get normal replies; shift events stay out of them
- **while he is afk, i pick**: every ask, an open one included, takes my best pick, and the plan file's report lists each with its undo. one goes up only when i'm blocked, it needs his design call, or it's irreversible; it parks in orbit and nothing wakes him (dima, 2026-11-05: «only hold ones that wants my attention i'll see when i return»; 2026-11-06: «for pending asks, you just decide yourself what's the best pick»)
- watch per `x:crew-lead`

## 3 · end — the report

A shift ends when its plan is done or on his word. In the plan file, then one chat message:

- **≤ 3 decisions that matter**, one line each, with a ➡️
- `kept as built: …` — everything else in one line, details in the file
- severity: 🔴 touches sign-in or data (read it) · 🟢 cosmetic (skim)
- stated plainly: **an unanswered item counts as accepted**, except one that moves, defers or drops a line of his or closes a ticket: that waits for his verdict (`craft-pm` § the ask-guard)
- the spend, the steer log, what the next plan changes
- the debrief reads «clear, compact, pretty, and readable … your proposals up front for how to solve unsolvables», themed per shift: atelier → mini art, chords → keyboard, sys → game (dima, 2026-09-27)
- then the return sections, one or two plain lines each: how it went (per lane: merged, parked, not run), what waited on dima and how it resolved, second winds (who, when, what survived), failures with their state now, merges and what held one, retros per member, the flow (good and off, a fix per off), ticket readiness (exit lines rewritten mid-lane, and why), anything else or `none`

Retros in, members stopped, 🔥 off, `pnpm -C ~/frame mods:set pace end`, which puts ⏰ back as it found it, the plan's `status:` flipped to `done`, orbit asks back on. the hand-over: the full report as an Artifact, a CST (`x:handoff`) with the open asks and this thread's transcript path, and the chat message's last line «questions → a fresh clio, `/clio:boot <slug>`».

**Done** = the report is in the file, the artifact and the chat, the CST is in the store, every member is stopped or carried on purpose, and nothing parked is lost.
