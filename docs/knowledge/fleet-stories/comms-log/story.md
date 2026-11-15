---
status: open
dates: 2026-11-13 → 2026-11-15
tickets: [FRM-630]
tags: [comms, dima-graded]
fed-by: incidents
---

# comms log — dima's graded comms cases

- rendered from `~/.claude/shelf/comms-log.jsonl` by `node ~/frame/_clio/script/comms-log-render.ts`; the jsonl is the one source, queried with duckdb
- a case: what happened, its context, his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home
- the rules (severity, the weekly retro) live in [comms-log.md](../../comms-log.md); the statistics of all talk in [fleet-operator-comms.md](../../fleet-operator-comms.md)

## c1 · ran-ahead · - · hot · fixed, watched

- **what:** clio ran his approved 10-step order alone while he spent ~34 min writing his reply; grills and asks of his started with no sign of him
- **how:** he ticked the day's order (o1) as approval; each member or job «done» (helga's receipts, wishkeeper's finish) woke a clio turn, and the last reply had named the next step
- **why:** no line told a member's done apart from his go; the approved order read as a script
- **when:** 13:40 tick → 14:55 reply → 14:59–15:09 the fleet-priority grill, the guard contract, parse fixes, a rex lookup
- **where:** the main thread in herdr's chat, a planning day, no lane running
- **who:** clio main, helga and wishkeeper (whose dones woke the turns), dima writing in the desktop app
- **his words:** «stop. why you run away without me?» · «im still writing a message to your reply … why you started a grill without seeting any activity from my side?» · «Never start any grills without me present»
- **shape:** pace: a new topic of his opened while he was still writing
- **fix:** his items wait for his prompt or his tick on the orbit «next:» ask; a member's done only continues clio's own work (habit-dima-comms § his items move at his pace); a Stop hint when a woken turn opens one of his items (siesta-gate.ts)
- **home:** FRM-630:W9–W16, commit 6b02ce90
- **source:** /Users/dima/.claude/projects/-Users-dima-frame--clio/71eef4ac-a29c-48ef-b147-c1dc088f8eff.jsonl (15:09, 15:12, 15:35, 16:01)

## c2 · restating · - · siesta · rule live, on trial to 11-20; repeat counts here

- **what:** after he agreed a plan, clio restated it back at length
- **how:** a plan settled in orbit ticks; the next reply reprinted the agreed steps as a long summary
- **why:** a habit of confirming by restating; he reads none of it once dispatched
- **when:** 11-13 evening (his o153), and he names it again 11-15 16:43
- **where:** the main thread, reply after a dispatch or a settled plan
- **who:** clio main, dima
- **his words:** «When we agree on a plan it is enough for me if you reply with something like, "The plan is in. I now proceed," or something like this. Simply confirm that you got it and you move, and no restatements are needed.» · «e.g. today i graded as useless your message that restated an already agreed plan.»
- **shape:** restating: an agreed plan reprinted
- **fix:** the reply after a settled plan is one line, «the plan is in, moving», plus only what deviates or risks
- **home:** habit-dima-comms (o153 trial)
- **source:** FRM-630:W3; habit-dima-comms «A reply never restates what he settled» (o153, a trial to 11-20)
