---
description: load when dima types /cclio:shift <plan>, says «start shift», «i go, run it», «i'm afk», or leaves a written plan to run without him.
argument-hint: "<plan file>"
---

# /cclio:shift <plan file>

A **shift** is a lane built to run without dima (FRM-266). A lane asks and waits. A shift
**decides, logs and continues**. The plan file is the authority; the last shift file in
`cclio/shifts/` is the template. A shift over ✍️ signed chunks names them in its plan and runs each through
`cclio:shape-lane-dispatch` in their order (lane init's contract: `craft-fleet-flow` § lane init) — nothing in it waits on dima.

## presence — his afk switch drives it (dima, 2026-10-22, PK-103 W107, W108)

one shift, day or night; how it drives follows the band's afk switch (💨, x-mod-stash), which puts an away note on every prompt while on:
- **afk on** — nothing waits on him. at most one y/n that fits a phone, and only for an irreversible
  step that blocks everything else.
- **afk off** — he is near for now: a y/n ping only for a real decision, batched at a siesta.
- a shift started with afk off gets one line: «afk is off — near for now, or a slip?»

## comms while he is away

- the main thread is cclio's own log: only what a post-compaction cclio or a returning dima needs.
- when he returns: **one** digest — done, decisions taken, parked asks — then the lane resumes.

## surviving a compaction

state lives on disk, never only in context: after **every** step, the plan file's `## log` gets
the current step, the decisions and the open asks. the `SessionStart:compact` hook (`.claude/hooks/shift-recompact.sh`)
re-reads a plan whose header says `status: running` after a compaction, and `pnpm shift:checkup` proves the hook.

- **the checkpoint is mine while he is away**: at 600–700k context I run `cclio:checkpoint` myself, at the end of a step, never mid-chunk (dima, 2026-10-07: «you reach 400k extremely fast … a good number for you to checkpoint is about 600k to 700k»; 2026-10-21: «during the shift, when I am AFK, it is fully up to you, so be careful with this»). `get_usage` reads it after every step.

## 1 · start — the last chat message

- `pnpm shift:checkup` in `~/frame` — every compaction guard red+green, spare age, `📡 pr-watch`, each with its why; any 🔴 = no shift
- the app passes `apps:essentials`
- write `status: running`, `afk:` (on/off at the start), the budget line (a % of the week) and the members into the plan file
- one message to dima: mode, members, budget, when the report lands. **from here the shift is on.**

## 2 · run — no asks

Every decision is one of three:

- **reversible** → take the default, log `decided: X — undo: Y`, continue
- **irreversible or external** (a merge, a delete, prod, a message, a setting, a move or drop of a line of dima's) → park it with its
  reason, never block other work on it; a merge is no park: a clean pr lands by the gate, and a self-edit lands when its
  chunk's `## signed` carries `merge: pre-approved`
- **taste** → build one default, flag it for the report

- a mods chunk starts as a desktop-native thread like any mods coder (`x:crew-lead` § the doors), never `--bg`
- a coder's premise doubt is built and flagged the same minute, never found at review
- events go to the plan file's `## log` (time · who · what · evidence), never to chat. while afk is off,
  dima's messages still get normal replies; shift events stay out of them
- **orbit asks are suspended** while a shift runs: decide, log and park instead of asking; the report carries the decisions
- watch per `x:crew-lead`

## 3 · end — the report

In the plan file, then one chat message:

- **≤ 3 decisions that matter**, one line each, with a ➡️
- `kept as built: …` — everything else in one line, details in the file
- severity: 🔴 touches sign-in or data (read it) · 🟢 cosmetic (skim)
- stated plainly: **an unanswered item counts as accepted**, except one that moves, defers or drops a line of his or closes a ticket: that waits for his verdict (`craft-pm` § the ask-guard)
- the spend, the steer log, what the next plan changes
- the debrief reads «clear, compact, pretty, and readable … your proposals up front for how to solve unsolvables», themed per shift: atelier → mini art, chords → keyboard, sys → game (dima, 2026-09-27)
- then the return sections, every shift, one or two lines each, in plain words:
  - **how it went**: per lane, merged / parked / not run
  - **what waited on dima**: each wait, and how it resolved — his word, or a decision of cclio's with its reason
  - **compactions**: count, and what survived each
  - **failures**: ci, keys, access, permissions, the 5h window — each with its state now
  - **merging**: count, and anything a checkup or a verifier held
  - **retros**: filed per member
  - **the flow**: planning, briefs, comms — good and off, with the fix for each off
  - **ticket readiness**: which tickets ran straight, which exit lines were rewritten mid-lane and why
  - **anything else** dima would want: one line or `none`

Retros in, members stopped, the plan's `status:` flipped to `done`, orbit asks back on.

Then the hand-over, because dima returns to a cold cache: his first question to a long shift thread re-writes the whole context at the 1h write price.

- the full report goes out as an Artifact — he reads it on any device for free
- a CST (`x:handoff`) carries the open asks and names this thread's transcript path (`~/.claude/projects/<project>/<session id>.jsonl`) for the tricky questions
- the chat message ends on one line: «questions → a fresh cclio, `/cclio:boot <slug>`»

**Done** = the report is in the file, the artifact and the chat, the CST is in the store, every member is stopped or carried on purpose, and nothing parked is lost.
