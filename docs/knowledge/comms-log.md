---
fed-by: incidents
when:
  - { kind: basename, value: habit-dima-comms.md }
---

# comms log — dima's graded comms cases, one section per case

## core

- the case log of [FRM-630](https://linear.app/x-com/issue/FRM-630): every comms slip or good reply dima grades, with its context, his words and the fix
- two copies, written the same turn: this file for dima to read, `~/.claude/shelf/comms-log.jsonl` for queries (duckdb); a case lands in both or neither
- a case holds: what happened, its context (how, why, when, where, who), his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home, status
- severity: hot is fixed the turn it lands; siesta at the next pause; halt is the default; the weekly retro turns repeated shapes into reply rules
- the statistics of all talk live in [fleet-operator-comms.md](fleet-operator-comms.md); this file holds the cases

## c1 · ran ahead of him · − · hot · fixed, watched

- **what:** clio ran his approved 10-step order alone while he spent ~34 min writing his reply; a grill and asks of his started with no sign of him
- **how:** he ticked the day's order (o1) as approval; each member's or job's «done» (helga's receipts, wishkeeper's finish) woke a clio turn, and the last reply had named the next step
- **why:** no line told a member's done apart from his go; the approved order read as a script
- **when:** 2026-11-15, 13:40 tick → 14:55 reply → 14:59–15:09 the fleet-priority grill, the guard contract, parse fixes, a rex lookup
- **where:** the main thread in herdr's chat, a planning day, no lane running
- **who:** clio main; helga and wishkeeper, whose dones woke the turns; dima, writing in the desktop app
- **his words:** «stop. why you run away without me?» · «Never start any grills without me present»
- **shape:** pace: a new topic of his opened while he was still writing
- **fix:** his items wait for his prompt or his tick on the orbit «next:» ask; a member's done only continues clio's own work (`habit-dima-comms` § his items move at his pace); a Stop hint when a woken turn opens one of his items (`siesta-gate.ts`)
- **home:** FRM-630:W9–W16

## c2 · an agreed plan restated · − · siesta · rule on trial to 11-20

- **what:** after he agreed a plan, clio restated it back at length
- **how:** a plan settled in orbit ticks; the next reply reprinted the agreed steps as a long summary
- **why:** a habit of confirming by restating; he reads none of it once dispatched
- **when:** 2026-11-13 evening (his o153); named again 2026-11-15 16:43
- **where:** the main thread, the reply after a dispatch or a settled plan
- **who:** clio main, dima
- **his words:** «Simply confirm that you got it and you move, and no restatements are needed.» · «e.g. today i graded as useless your message that restated an already agreed plan.»
- **shape:** restating: an agreed plan reprinted
- **fix:** the reply after a settled plan is one line, «the plan is in, moving», plus only what deviates or risks (`habit-dima-comms`, o153)
- **home:** FRM-630:W3
