---
description: load when dima types /cclio:shift <plan>, says «start shift», «i go, run it», «i'm afk», or leaves a written plan to run without him — the mode that decides, logs and continues instead of asking.
argument-hint: "<plan file>"
---

# /cclio:shift <plan file>

A **shift** is a lane built to run without dima (FRM-266). A lane asks and waits. A shift
**decides, logs and continues**. The plan file is the authority; the last shift file in
`cclio/shifts/` is the template.

## presence — near or away

- `near` — dima is around but busy: a y/n ping only for a real decision, batched at a pit stop.
- `away` — nothing waits on him. at most one y/n that fits a phone, and only for an irreversible
  step that blocks everything else.

Members are named `🎯 🔧 <shift> code: …`, `🎯 🔎 <shift> verify: …`.

## comms while he is away

- the main thread is cclio's own log: only what a post-compaction cclio or a returning dima needs.
- members message cclio only on done, blocked or a decision; progress is never sent.
- when he returns: **one** digest — done, decisions taken, parked asks — then the lane resumes.

## surviving a compaction

state lives on disk, never only in context: after **every** step, the plan file's `## log` gets
the current step, the decisions and the open asks. after a compaction, re-read the plan file
before the next action. the `SessionStart:compact` hook (`.claude/hooks/shift-recompact.sh`) enforces
it: a plan whose header says `status: running` makes the compacted cclio Read the plan and this skill
first, with the log's tail printed. 📌 the next shift forces one `/compact` mid-run and checks that the
step and the decisions survive.

## 1 · start — the last chat message

- `pnpm shift:checkup` in `~/frame` — every compaction guard red+green, spare age, `📡 pr-watch`, each with its why; any 🔴 = no shift
- the app passes `apps:essentials`
- write `status: running`, `presence:` (near/away), the budget line (a % of the week) and the members into the plan file
- one message to dima: mode, members, budget, when the report lands. **from here the shift is on.**

## 2 · run — no asks

Every decision is one of three:

- **reversible** → take the default, log `decided: X — undo: Y`, continue
- **irreversible or external** (a merge, a delete, prod, a message, a setting) → park it with its
  reason, never block other work on it
- **taste** → build one default, flag it for the report

- a coder's premise doubt is built and flagged the same minute, never found at review
- events go to the plan file's `## log` (time · who · what · evidence), never to chat. when `near`,
  dima's lane messages still get normal replies; shift events stay out of them
- **the ⏳ block is suspended** while a shift runs: decide, log and park instead of asking; the report carries the decisions
- watch per `craft-spawning`: a watch lives until its pr merges; every idle notice is a check

## 3 · end — the report

In the plan file, then one chat message:

- **≤ 3 decisions that matter**, one line each, with a ➡️
- `kept as built: …` — everything else in one line, details in the file
- severity: 🔴 touches sign-in or data (read it) · 🟢 cosmetic (skim)
- stated plainly: **an unanswered item counts as accepted**
- the spend, the steer log, what the next plan changes

Retros in, members stopped, the plan's `status:` flipped to `done`, the ⏳ block back on.

Then the hand-over, because dima returns to a cold cache: his first question to a long shift thread re-writes the whole context at the 1h write price.

- the full report goes out as an Artifact — he reads it on any device for free
- a CST (`x:handoff`) carries the open asks and names this thread's transcript path (`~/.claude/projects/<project>/<session id>.jsonl`) for the tricky questions
- the chat message ends on one line: «questions → a fresh cclio, `/cclio:boot <slug>`»

**Done** = the report is in the file, the artifact and the chat, the CST is in the store, every member is stopped or carried on purpose, and nothing parked is lost.
