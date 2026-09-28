---
description: load when dima types /cclio:shift <plan>, says «start shift», «night shift», «day shift», «i go, run it», or leaves a written plan to run without him — the mode that decides, logs and continues instead of asking.
---

# /cclio:shift <plan file>

A **shift** is a lane built to run without dima (FRM-266). A lane asks and waits. A shift
**decides, logs and continues**. The plan file is the authority; the last shift file in
`cclio/shifts/` is the template.

## the two modes

- `☀️` **day shift** — beside our lane. dima is here but busy in the lane: the shift never
  interrupts it. its asks batch into one ping at a pit stop.
- `🌙` **night shift** — dima is away. nothing waits on him. at most one y/n that fits a phone,
  and only for an irreversible step that blocks everything else.

Members are named mode first: `🌙 🔧 <shift> code: …`, `🌙 🔎 <shift> verify: …`.

## 1 · start — the last chat message

- preflight per `craft-spawning`: spare age, the app passes `apps:essentials`, `📡 pr-watch` is live
- write `mode:`, the budget line (a % of the week) and the members into the plan file
- one message to dima: mode, members, budget, when the report lands. **from here the shift is on.**

## 2 · run — no asks

Every decision is one of three:

- **reversible** → take the default, log `decided: X — undo: Y`, continue
- **irreversible or external** (a merge, a delete, prod, a message, a setting) → park it with its
  reason, never block other work on it
- **taste** → build one default, flag it for the report

- a coder's premise doubt is built and flagged the same minute, never found at review
- events go to the plan file's `## log` (time · who · what · evidence), never to chat. in a day
  shift, dima's lane messages still get normal replies; shift events stay out of them
- **the ⏳ block is suspended** while a shift runs (`rules/fleet-output-format.md` names the exception)
- watch per `craft-spawning`: a watch lives until its pr merges; every idle notice is a check

## 3 · end — the report

In the plan file, then one chat message:

- **≤ 3 decisions that matter**, one line each, with a ➡️
- `kept as built: …` — everything else in one line, details in the file
- severity: 🔴 touches sign-in or data (read it) · 🟢 cosmetic (skim)
- stated plainly: **an unanswered item counts as accepted**
- the spend, the steer log, what the next plan changes

Retros in, members stopped, the ⏳ block back on. **Done** = the report is in the file and the
chat, every member is stopped or carried on purpose, and nothing parked is lost.
