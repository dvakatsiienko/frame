---
description: load when dima says «wind-down», «wind down», «in 2–3 h we finish», «gradually stop everyone», «finish everything for today», «finish as soon as possible», «stop everyone now» — main clio only, the day's lanes ready to park on one stop word.
---

# /clio:wind-down — the day's lanes park on one stop word

his want (PK-363:W1124–W1130, 2026-11-11): he names a window («up to 3 h»); every lane knows we are winding down and parks on one shared stop word at its nearest clean point (step 5); the estimate comes from the day's real cadence, never from inference; only his word stops a lane. main clio runs it; a wing estimates its own lanes and follows main's plan.

## the steps

0. **the window**: his number; none in his words → one orbit ask «wind-down window: how long?», nothing starts before it
1. **the roster**: `ListAgents` and every live 🛼 glide; per lane: its chunk and the lane-plan steps it has left
2. **the cadence, measured**: per lane, its own landed steps with their commit times (`git log --format='%h %ad %s'` over the lane's paths, or its lane plan's ticked steps with their shas), the newest hour first: its median minutes a step; a lane with under 3 steps in that hour takes the day's median
3. **the wings estimate too**: a message to each wing running a lane: «wind-down: estimate your lanes: steps left, minutes a step, the finish HH:MM». the lane's estimate is the median of the wing's number and mine
4. **the estimate, printed**: one line per lane — `<lane> — <n> steps left × <m> min (today: <k> steps, median <m>) → reaches step <k> in his window`; a number without its source never prints
5. **the briefs, one stop word for every lane** (dima, 2026-11-23: «what i value more is the synchronous stop of all lanes»; «instead of taking the chunk merge as a stop point, we could just granularize and stick to slices, or even steps in the plan of the lane»): the stop point is the nearest clean one the time allows: a plan step, a slice, or the whole chunk if it lands, never a chunk's merge by rule (his 19:16: «as granular as possible»; «make stop not mandatory … let everyone aware that we are winding down so they are ready to stop at whichever nearest step or slice or chunk they are at»); each member gets «wind-down: keep working; keep every step committable in ~15 min and your handoff draft current; on my «stop», commit at the nearest clean point, hand off naming the next step and what is half-open, park; never stop»; the stop word goes to every lane in one turn, when his items and the tails are solved, or at an HH:MM only when he names one; a lane that lands its chunk before the stop word takes its next sealed chunk (PK-363:W1153 «you can send herdr codie another slice, so he is not parked for free»), an unsealed one getting its seal that turn, an unsigned one going to dima as a sign ask; a step started late in the window is low-risk (a wisp, a test, a look), a guard, sign or merge change lands only after its sixth sense round; a feature that needs his hands lands behind a switch until he tries it; a pr left open at the stop stays open, named in the handoff with its next act; his «now» or «as soon as possible» is the stop word at once: each member finishes only the step in its hands, minutes not hours; a member stops its pr Monitor (`TaskStop`) before a second wind and re-arms it after the pickup, since a live watch holds the wind silently (`wind-run.ts`); «do it now» is the default whenever it fits the window, never «tomorrow» (his o3, 11-18)
6. **the check-ins**: at the window's half and 30 min before its end, one line per lane — on track or behind, re-estimated from the newest commits; a lane's state comes from its member (`node ~/frame/_clio/script/check-idle.ts <name>`) and its newest commit, never from its lane plan's ticks alone
6.5 **the tails**: a tail no lane owns is solved tonight; it moves to a later day only on his word or when it needs a fresh session, and the reply names which (11-13: three «homed for Monday» overridden in 25 min, «i want all non-lane tails to be solved»)
7. **the end**: each parked member's handoff is read against the night's decisions and rewritten through `x handoff write --replaces` where it misses one; then each parked lane gets its own `⚠️ stop <member>` orbit ask. then one orbit ask for the halt, run with him, after the day's tails and tomorrow's prep
8. **the log**: per lane, estimate vs real finish, one line in `docs/test-drive/wind-down.md`, written before the halt ask goes out; the done test: every lane parked on the one stop word at a committed step, its handoff naming the next one

## never

- a park or a stop decided by the estimate alone (his W1127: off estimates stopped lanes too early)
- a lane stopped before his tick
- a wing running its own wind-down: main runs one, the wings follow it
